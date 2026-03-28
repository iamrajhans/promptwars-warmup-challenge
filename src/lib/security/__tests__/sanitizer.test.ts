import { describe, it, expect } from 'vitest';
import { sanitizeTextInput, validateFileMime, validateFileSize } from '../sanitizer';

describe('sanitizeTextInput', () => {
  it('should accept valid normal text', () => {
    const result = sanitizeTextInput('There is a fire at 123 Main Street');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedText).toBe('There is a fire at 123 Main Street');
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty input', () => {
    const result = sanitizeTextInput('');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('required');
  });

  it('should reject null/undefined input', () => {
    const result = sanitizeTextInput(null as unknown as string);
    expect(result.isValid).toBe(false);
  });

  it('should reject text exceeding 5000 characters', () => {
    const longText = 'a'.repeat(5001);
    const result = sanitizeTextInput(longText);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('5000');
  });

  it('should accept text at exactly 5000 characters', () => {
    const maxText = 'a'.repeat(5000);
    const result = sanitizeTextInput(maxText);
    expect(result.isValid).toBe(true);
  });

  it('should strip <script> tags', () => {
    const result = sanitizeTextInput('Hello <script>alert("xss")</script> world');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedText).not.toContain('<script>');
    expect(result.sanitizedText).toContain('[removed]');
  });

  it('should strip <iframe> tags', () => {
    const result = sanitizeTextInput('Check <iframe src="evil.com"></iframe> this');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedText).not.toContain('<iframe');
  });

  it('should strip null bytes', () => {
    const result = sanitizeTextInput('test\0input');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedText).toBe('testinput');
  });

  it('should handle text with angle brackets aggressively when dangerous patterns detected', () => {
    const result = sanitizeTextInput('Check this onclick=alert(1) <div>test</div>');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedText).not.toContain('<div>');
  });

  it('should preserve safe emergency descriptions intact', () => {
    const emergencyText = 'Multi-car accident on I-95 northbound near exit 42. At least 3 vehicles involved. Possible injuries.';
    const result = sanitizeTextInput(emergencyText);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedText).toBe(emergencyText);
  });
});

describe('validateFileMime', () => {
  it('should accept valid image MIME types', () => {
    expect(validateFileMime('image/jpeg', 'image').isValid).toBe(true);
    expect(validateFileMime('image/png', 'image').isValid).toBe(true);
    expect(validateFileMime('image/webp', 'image').isValid).toBe(true);
  });

  it('should reject invalid image MIME types', () => {
    const result = validateFileMime('image/gif', 'image');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('image/gif');
  });

  it('should accept valid audio MIME types', () => {
    expect(validateFileMime('audio/webm', 'audio').isValid).toBe(true);
    expect(validateFileMime('audio/wav', 'audio').isValid).toBe(true);
    expect(validateFileMime('audio/mpeg', 'audio').isValid).toBe(true);
  });

  it('should reject invalid audio MIME types', () => {
    const result = validateFileMime('audio/ogg', 'audio');
    expect(result.isValid).toBe(false);
  });

  it('should reject application MIME types for images', () => {
    const result = validateFileMime('application/pdf', 'image');
    expect(result.isValid).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('should accept images under 10MB', () => {
    expect(validateFileSize(5 * 1024 * 1024, 'image').isValid).toBe(true);
  });

  it('should reject images over 10MB', () => {
    const result = validateFileSize(11 * 1024 * 1024, 'image');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('10MB');
  });

  it('should accept audio under 25MB', () => {
    expect(validateFileSize(20 * 1024 * 1024, 'audio').isValid).toBe(true);
  });

  it('should reject audio over 25MB', () => {
    const result = validateFileSize(26 * 1024 * 1024, 'audio');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('25MB');
  });

  it('should accept zero-byte files', () => {
    expect(validateFileSize(0, 'image').isValid).toBe(true);
  });
});
