import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/security/rate-limiter';

// Mock AI extraction and Storage upload
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
  });

  it('successfully processes multi-modal input with images', async () => {
    // Create a FormData request with text and an image
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
    
    // Verify attachment contains public_url
    expect(data.document.attachments[0].public_url).toBe('https://storage.com/test.png');
  });

  it('returns 429 when rate limited', async () => {
     // Mock rate limiter to fail for this call
     vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterMs: 60000, remaining: 0 });

     const request = new NextRequest('http://localhost:3000/api/ingest', {
       method: 'POST',
       body: JSON.stringify({ input: 'test' }),
     });

     const response = await POST(request);
     expect(response.status).toBe(429);
  });
});
