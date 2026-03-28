/**
 * Security Sanitizer Module
 * Strips XSS vectors, validates MIME types, enforces input constraints.
 */

const MAX_TEXT_LENGTH = 5000;
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_AUDIO_MIMES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4'];

// Patterns that indicate XSS or injection attempts
const DANGEROUS_PATTERNS = [
  /<script[\s>]/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,        // onclick=, onerror=, etc.
  /data:text\/html/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<form/gi,
  /eval\s*\(/gi,
  /document\.(cookie|domain|write)/gi,
  /window\.(location|open)/gi,
];

export interface SanitizeResult {
  isValid: boolean;
  sanitizedText: string;
  errors: string[];
}

/**
 * Sanitizes text input by stripping dangerous HTML/script patterns.
 * We intentionally do NOT strip all HTML — Gemini needs the raw semantic
 * context. We only strip vectors that could execute in a browser.
 */
export function sanitizeTextInput(rawText: string): SanitizeResult {
  const errors: string[] = [];

  if (!rawText || typeof rawText !== 'string') {
    return { isValid: false, sanitizedText: '', errors: ['Input text is required.'] };
  }

  // Enforce length
  if (rawText.length > MAX_TEXT_LENGTH) {
    errors.push(`Input exceeds maximum length of ${MAX_TEXT_LENGTH} characters.`);
    return { isValid: false, sanitizedText: '', errors };
  }

  // Strip null bytes (common injection vector)
  let cleaned = rawText.replace(/\0/g, '');

  // Strip HTML tags that could execute scripts, but leave the text content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[removed]');
  cleaned = cleaned.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '[removed]');
  cleaned = cleaned.replace(/<object\b[^>]*>.*?<\/object>/gi, '[removed]');
  cleaned = cleaned.replace(/<embed\b[^>]*\/?>/gi, '[removed]');

  // Check for remaining dangerous patterns (warn but don't block — log for audit)
  const detectedThreats: string[] = [];
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(cleaned)) {
      detectedThreats.push(pattern.source);
    }
  }

  if (detectedThreats.length > 0) {
    console.warn('[SECURITY] Potential injection patterns detected in input:', detectedThreats);
    // Strip remaining angle brackets aggressively if threats detected
    cleaned = cleaned.replace(/<[^>]*>/g, '');
  }

  return { isValid: true, sanitizedText: cleaned.trim(), errors };
}

/**
 * Validates that a file's MIME type is in the allowed list for its category.
 */
export function validateFileMime(mimeType: string, category: 'image' | 'audio'): { isValid: boolean; error?: string } {
  const allowedMimes = category === 'image' ? ALLOWED_IMAGE_MIMES : ALLOWED_AUDIO_MIMES;

  if (!allowedMimes.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid ${category} type: "${mimeType}". Allowed: ${allowedMimes.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Validates file size. Max 10MB for images, 25MB for audio.
 */
export function validateFileSize(sizeBytes: number, category: 'image' | 'audio'): { isValid: boolean; error?: string } {
  const maxBytes = category === 'image' ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
  const maxMB = maxBytes / (1024 * 1024);

  if (sizeBytes > maxBytes) {
    return {
      isValid: false,
      error: `File too large. Maximum ${category} size is ${maxMB}MB.`
    };
  }

  return { isValid: true };
}
