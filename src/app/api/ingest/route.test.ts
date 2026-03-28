import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { extractIntent } from '@/lib/ai/gemini';
import { getAllIntents, saveIntent, updateIntentStatus } from '@/lib/db/firestore-mock';
import { uploadFile } from '@/lib/storage/gcs';
import * as sanitizer from '@/lib/security/sanitizer';

vi.mock('@/lib/ai/gemini', () => ({
  extractIntent: vi.fn().mockResolvedValue({
    intent_summary: 'Test Emergency',
    urgency: 5,
    recommended_action: 'Dispatching units',
    input_modalities: ['text', 'image'],
  }),
}));

vi.mock('@/lib/storage/gcs', () => ({
  uploadFile: vi.fn().mockResolvedValue({
    uri: 'gs://mock-bucket/test.png',
    publicUrl: 'https://storage.com/test.png',
    originalName: 'test.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    storedLocally: false,
  }),
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 5 }),
}));

describe('Ingest API Route Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.mockIntents = [];
  });

  it('successfully processes multi-modal input with images', async () => {
    const formData = new FormData();
    formData.append('input', 'Help, there is a fire!');

    const blob = new Blob(['fake-image-binary'], { type: 'image/png' });
    formData.append('image', blob, 'fire.png');

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.document.intent_summary).toBe('Test Emergency');
    expect(data.document.attachments[0].public_url).toBe('https://storage.com/test.png');
    expect(extractIntent).toHaveBeenCalled();
  });

  it('starts both media uploads before awaiting either result', async () => {
    let resolveImageUpload!: (value: unknown) => void;
    let resolveAudioUpload!: (value: unknown) => void;
    const uploadCalls: string[] = [];

    vi.mocked(uploadFile)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            uploadCalls.push('image');
            resolveImageUpload = resolve;
          }) as ReturnType<typeof uploadFile>
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            uploadCalls.push('audio');
            resolveAudioUpload = resolve;
          }) as ReturnType<typeof uploadFile>
      );

    const formData = new FormData();
    formData.append('input', 'Fire and voice memo');
    formData.append('image', new Blob(['fake-image'], { type: 'image/png' }), 'scene.png');
    formData.append('audio', new Blob(['fake-audio'], { type: 'audio/webm' }), 'scene.webm');

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });

    const responsePromise = POST(request);
    for (let attempt = 0; attempt < 20 && vi.mocked(uploadFile).mock.calls.length < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(uploadCalls).toEqual(['image', 'audio']);

    resolveImageUpload({
      uri: 'gs://mock-bucket/scene.png',
      publicUrl: 'https://storage.com/scene.png',
      originalName: 'scene.png',
    });
    resolveAudioUpload({
      uri: 'gs://mock-bucket/scene.webm',
      publicUrl: 'https://storage.com/scene.webm',
      originalName: 'scene.webm',
    });

    const response = await responsePromise;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.document.attachments).toHaveLength(2);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      retryAfterMs: 60000,
      remaining: 0,
    });

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ input: 'test' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('rejects requests with no usable input', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ input: '' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('At least one input');
  });

  it('rejects invalid image mime types', async () => {
    const formData = new FormData();
    formData.append('image', new Blob(['fake'], { type: 'image/gif' }), 'bad.gif');

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid image type');
  });

  it('rejects oversized audio uploads', async () => {
    const formData = new FormData();
    const hugeAudio = new File([new Uint8Array(1)], 'clip.webm', { type: 'audio/webm' });
    vi.spyOn(hugeAudio, 'size', 'get').mockReturnValue(26 * 1024 * 1024);
    formData.append('audio', hugeAudio);

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Maximum audio size is 25MB');
  });

  it('returns sanitizer validation errors', async () => {
    vi.spyOn(sanitizer, 'sanitizeTextInput').mockReturnValueOnce({
      isValid: false,
      sanitizedText: '',
      errors: ['Unsafe input detected.'],
    });

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ input: 'bad input' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Unsafe input detected.');
  });

  it('returns a 500 when the model invocation fails', async () => {
    vi.mocked(extractIntent).mockRejectedValueOnce(new Error('model failure'));

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ input: 'help' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('internal error');
  });

  it('returns no-store cache headers for intent polling', async () => {
    await saveIntent(
      {
        raw_text: 'Existing fire alert',
        intent_summary: 'Existing fire alert',
        urgency: 4,
        recommended_action: 'Dispatch units',
        input_modalities: ['text'],
      },
      []
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(data.intents).toHaveLength(1);
    expect(getAllIntents).toBeTypeOf('function');
  });

  it('returns a 500 when listing intents fails', async () => {
    vi.spyOn(global, 'mockIntents', 'get').mockImplementationOnce(() => {
      throw new Error('db down');
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Database Error');
  });

  it('updates an intent status through PATCH', async () => {
    const saved = await saveIntent(
      {
        raw_text: 'Caller waiting',
        intent_summary: 'Caller waiting',
        urgency: 2,
        recommended_action: 'Call back',
        input_modalities: ['text'],
      },
      []
    );

    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'PATCH',
      body: JSON.stringify({ id: saved.id, status: 'acknowledged' }),
      headers: { 'content-type': 'application/json' },
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const intents = await getAllIntents();
    expect(intents[0].status).toBe('acknowledged');
  });

  it('rejects PATCH requests missing id or status', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'PATCH',
      body: JSON.stringify({ id: '' }),
      headers: { 'content-type': 'application/json' },
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing id or status');
  });

  it('returns a PATCH database update error when request parsing fails', async () => {
    const request = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'PATCH',
      body: '{',
      headers: { 'content-type': 'application/json' },
    });

    const { PATCH } = await import('./route');
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Database Update Error');
  });
});
