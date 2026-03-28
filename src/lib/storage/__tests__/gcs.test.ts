import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock before any imports
const { mockSave, mockFile, mockBucket, mockGetSignedUrl } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockGetSignedUrl = vi.fn().mockResolvedValue(['https://signed-url.com/test.png']);
  const mockFile = vi.fn(() => ({ 
    save: mockSave,
    getSignedUrl: mockGetSignedUrl
  }));
  const mockBucket = vi.fn(() => ({ file: mockFile }));
  return { mockSave, mockFile, mockBucket, mockGetSignedUrl };
});

vi.mock('@google-cloud/storage', () => ({
  Storage: class MockStorage {
    bucket = mockBucket;
    constructor() {}
  },
}));

import { uploadFile, getLocalFile } from '../gcs';

// Reset the global local file store before each test
beforeEach(() => {
  global.__localFileStore = new Map();
  mockSave.mockClear();
  mockFile.mockClear();
  mockBucket.mockClear();
  mockGetSignedUrl.mockClear();
  delete process.env.GCS_BUCKET_NAME;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
});

describe('uploadFile - local fallback', () => {
  it('should store files locally when GCS is not configured', async () => {
    const buffer = Buffer.from('fake image data');
    const result = await uploadFile(buffer, 'test.jpg', 'image/jpeg');

    expect(result.uri).toMatch(/^local:\/\//);
    expect(result.publicUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.originalName).toBe('test.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sizeBytes).toBe(buffer.length);
    expect(result.storedLocally).toBe(true);
  });

  it('should store correct file sizes', async () => {
    const data = Buffer.from('a'.repeat(1024));
    const result = await uploadFile(data, 'file.png', 'image/png');
    expect(result.sizeBytes).toBe(1024);
  });

  it('should generate unique local IDs for each upload', async () => {
    const buf = Buffer.from('data');
    const r1 = await uploadFile(buf, 'a.jpg', 'image/jpeg');
    const r2 = await uploadFile(buf, 'b.jpg', 'image/jpeg');
    expect(r1.uri).not.toBe(r2.uri);
  });

  it('should handle empty buffer', async () => {
    const result = await uploadFile(Buffer.alloc(0), 'empty.jpg', 'image/jpeg');
    expect(result.sizeBytes).toBe(0);
    expect(result.storedLocally).toBe(true);
  });

  it('should handle audio files locally', async () => {
    const result = await uploadFile(Buffer.from('audio data'), 'recording.webm', 'audio/webm');
    expect(result.mimeType).toBe('audio/webm');
    expect(result.originalName).toBe('recording.webm');
    expect(result.storedLocally).toBe(true);
    expect(result.publicUrl).toContain('data:audio/webm;base64,');
  });

  it('should fall back when bucket is not set but credentials exist', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/some/path.json';
    const result = await uploadFile(Buffer.from('test'), 'file.jpg', 'image/jpeg');
    expect(result.storedLocally).toBe(true);
  });
});

describe('uploadFile - GCS success path', () => {
  it('should upload to GCS and return a gs:// URI with signed publicUrl when env vars are set', async () => {
    process.env.GCS_BUCKET_NAME = 'my-test-bucket';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/fake/path.json';

    const buffer = Buffer.from('image content');
    const result = await uploadFile(buffer, 'photo.jpg', 'image/jpeg');

    expect(result.uri).toMatch(/^gs:\/\/my-test-bucket\//);
    expect(result.publicUrl).toBe('https://signed-url.com/test.png');
    expect(result.originalName).toBe('photo.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sizeBytes).toBe(buffer.length);
    expect(result.storedLocally).toBe(false);

    // Verify GCS SDK was called correctly
    expect(mockBucket).toHaveBeenCalledWith('my-test-bucket');
    expect(mockFile).toHaveBeenCalledWith(expect.stringContaining('photo.jpg'));
    expect(mockSave).toHaveBeenCalledWith(buffer, {
      metadata: { contentType: 'image/jpeg' },
      resumable: false,
    });
    expect(mockGetSignedUrl).toHaveBeenCalled();
  });

  it('should organize files under date-prefixed paths with timestamps in GCS', async () => {
    process.env.GCS_BUCKET_NAME = 'my-bucket';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/fake/creds.json';

    await uploadFile(Buffer.from('data'), 'audio.webm', 'audio/webm');

    const calledPath = (mockFile.mock.calls[0] as string[])[0];
    // Path should now end with a timestamp suffix
    expect(calledPath).toMatch(/^uploads\/\d{4}-\d{2}-\d{2}\/audio\.webm-\d+$/);
  });

  it('should fall back to local if GCS save throws', async () => {
    process.env.GCS_BUCKET_NAME = 'broken-bucket';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/fake/creds.json';
    mockSave.mockRejectedValueOnce(new Error('GCS network error'));

    const result = await uploadFile(Buffer.from('test'), 'file.jpg', 'image/jpeg');

    expect(result.storedLocally).toBe(true);
    expect(result.uri).toMatch(/^local:\/\//);
  });
});

describe('getLocalFile', () => {
  it('should return undefined for non-existent file', () => {
    expect(getLocalFile('nonexistent_id')).toBeUndefined();
  });

  it('should retrieve a locally stored file after upload', async () => {
    const content = 'test file content';
    const buffer = Buffer.from(content);
    const uploadResult = await uploadFile(buffer, 'test.txt', 'text/plain');

    const localId = uploadResult.uri.replace('local://', '');
    const retrieved = getLocalFile(localId);

    expect(retrieved).toBeDefined();
    expect(Buffer.from(retrieved!, 'base64').toString()).toBe(content);
  });
});
