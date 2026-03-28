import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock function is available during vi.mock factory hoisting
const { mockGenerateContent } = vi.hoisted(() => {
  return { mockGenerateContent: vi.fn() };
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = { generateContent: mockGenerateContent };
      constructor() {}
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      INTEGER: 'INTEGER',
    },
  };
});

// Import AFTER mock registration
import { extractIntent } from '../gemini';

beforeEach(() => {
  mockGenerateContent.mockReset();
});

describe('extractIntent', () => {
  it('should extract intent from text input', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        intent_summary: 'Car accident on highway',
        urgency: 4,
        recommended_action: 'Dispatch ambulance',
      }),
    });

    const result = await extractIntent({ text: 'There is a car crash on I-95' });

    expect(result.intent_summary).toBe('Car accident on highway');
    expect(result.urgency).toBe(4);
    expect(result.recommended_action).toBe('Dispatch ambulance');
    expect(result.raw_text).toBe('There is a car crash on I-95');
    expect(result.input_modalities).toContain('text');
  });

  it('should extract intent from image-only input and prepend context', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        intent_summary: 'Building fire',
        urgency: 5,
        recommended_action: 'Send fire department',
      }),
    });

    const result = await extractIntent({
      imageBase64: 'base64data',
      imageMimeType: 'image/jpeg',
    });

    expect(result.input_modalities).toContain('image');
    expect(result.urgency).toBe(5);
    expect(result.raw_text).toContain('image');

    // Context prompt prepended since no text was provided
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts;
    expect(parts[0].text).toContain('image');
    expect(parts[1].inlineData).toBeDefined();
  });

  it('should extract intent from audio-only input and prepend context', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        intent_summary: 'Person calling for help',
        urgency: 4,
        recommended_action: 'Dispatch police',
      }),
    });

    const result = await extractIntent({
      audioBase64: 'audiodata',
      audioMimeType: 'audio/webm',
    });

    expect(result.input_modalities).toContain('audio');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts;
    expect(parts[0].text).toContain('audio');
    expect(parts[1].inlineData.mimeType).toBe('audio/webm');
  });

  it('should handle combined text + image without extra context prompt', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        intent_summary: 'Flooding reported',
        urgency: 3,
        recommended_action: 'Alert flood team',
      }),
    });

    const result = await extractIntent({
      text: 'Lots of water on the road',
      imageBase64: 'imgdata',
      imageMimeType: 'image/png',
    });

    expect(result.input_modalities).toEqual(['text', 'image']);
    expect(result.raw_text).toBe('Lots of water on the road');

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts;
    expect(parts[0].text).toBe('Lots of water on the road');
  });

  it('should handle all three modalities combined', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        intent_summary: 'Multi-modal emergency',
        urgency: 5,
        recommended_action: 'Full dispatch',
      }),
    });

    const result = await extractIntent({
      text: 'Help needed',
      imageBase64: 'imgdata',
      imageMimeType: 'image/jpeg',
      audioBase64: 'audiodata',
      audioMimeType: 'audio/webm',
    });

    expect(result.input_modalities).toEqual(['text', 'image', 'audio']);
  });

  it('should return safe defaults on null response text', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: null });

    const result = await extractIntent({ text: 'Test' });

    expect(result.intent_summary).toBe('Could not parse intent summary.');
    expect(result.urgency).toBe(1);
    expect(result.recommended_action).toBe('Manual operator review required.');
  });

  it('should return safe defaults on empty JSON response', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: '{}' });

    const result = await extractIntent({ text: 'Test' });

    expect(result.intent_summary).toBe('Could not parse intent summary.');
    expect(result.urgency).toBe(1);
  });

  it('should throw when no input modality is provided', async () => {
    await expect(extractIntent({})).rejects.toThrow('At least one input modality');
  });

  it('should propagate Gemini API errors', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API quota exceeded'));

    await expect(extractIntent({ text: 'Test' })).rejects.toThrow('API quota exceeded');
  });

  it('should set temperature to 0.1 for deterministic output', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ intent_summary: 'T', urgency: 1, recommended_action: 'N' }),
    });

    await extractIntent({ text: 'Test' });

    expect(mockGenerateContent.mock.calls[0][0].config.temperature).toBe(0.1);
  });

  it('should request application/json response MIME type', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ intent_summary: 'T', urgency: 1, recommended_action: 'N' }),
    });

    await extractIntent({ text: 'Test' });

    expect(mockGenerateContent.mock.calls[0][0].config.responseMimeType).toBe('application/json');
  });

  it('should target gemini-3.1-pro-preview model', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ intent_summary: 'T', urgency: 1, recommended_action: 'N' }),
    });

    await extractIntent({ text: 'Test' });

    expect(mockGenerateContent.mock.calls[0][0].model).toBe('gemini-3.1-pro-preview');
  });
});
