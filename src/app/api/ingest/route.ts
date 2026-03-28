import { NextRequest, NextResponse } from 'next/server';
import { extractIntent, GeminiInputParts } from '@/lib/ai/gemini';
import { saveIntent, getAllIntents, updateIntentStatus, Attachment } from '@/lib/db/firestore-mock';
import { sanitizeTextInput, validateFileMime, validateFileSize } from '@/lib/security/sanitizer';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { uploadFile } from '@/lib/storage/gcs';

/**
 * Extract client IP from request headers (works behind Cloud Run proxy).
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(request);
    const rateLimitResult = checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // 2. Parse input — support both JSON and FormData
    const contentType = request.headers.get('content-type') || '';
    let textInput = '';
    let imageBuffer: Buffer | null = null;
    let imageMimeType = '';
    let imageFileName = '';
    let audioBuffer: Buffer | null = null;
    let audioMimeType = '';
    let audioFileName = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      textInput = (formData.get('input') as string) || '';

      const imageFile = formData.get('image') as File | null;
      if (imageFile && imageFile.size > 0) {
        const mimeCheck = validateFileMime(imageFile.type, 'image');
        if (!mimeCheck.isValid) {
          return NextResponse.json({ error: mimeCheck.error }, { status: 400 });
        }
        const sizeCheck = validateFileSize(imageFile.size, 'image');
        if (!sizeCheck.isValid) {
          return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
        }
        imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        imageMimeType = imageFile.type;
        imageFileName = imageFile.name;
      }

      const audioFile = formData.get('audio') as File | null;
      if (audioFile && audioFile.size > 0) {
        const mimeCheck = validateFileMime(audioFile.type, 'audio');
        if (!mimeCheck.isValid) {
          return NextResponse.json({ error: mimeCheck.error }, { status: 400 });
        }
        const sizeCheck = validateFileSize(audioFile.size, 'audio');
        if (!sizeCheck.isValid) {
          return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
        }
        audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        audioMimeType = audioFile.type;
        audioFileName = audioFile.name;
      }
    } else {
      // JSON fallback for text-only
      const body = await request.json();
      textInput = body.input || '';
    }

    // 3. Validate: at least one modality must be present
    if (!textInput && !imageBuffer && !audioBuffer) {
      return NextResponse.json(
        { error: 'At least one input (text, image, or audio) is required.' },
        { status: 400 }
      );
    }

    // 4. Sanitize text input
    if (textInput) {
      const sanitizeResult = sanitizeTextInput(textInput);
      if (!sanitizeResult.isValid) {
        return NextResponse.json(
          { error: sanitizeResult.errors.join(' ') },
          { status: 400 }
        );
      }
      textInput = sanitizeResult.sanitizedText;
    }

    // 5. Upload files to GCS (or local fallback) for audit trail
    const attachments: Attachment[] = [];

    if (imageBuffer) {
      const uploadResult = await uploadFile(imageBuffer, imageFileName, imageMimeType);
      attachments.push({
        type: 'image',
        gcs_uri: uploadResult.uri,
        original_name: uploadResult.originalName,
        mime_type: imageMimeType,
      });
    }

    if (audioBuffer) {
      const uploadResult = await uploadFile(audioBuffer, audioFileName, audioMimeType);
      attachments.push({
        type: 'audio',
        gcs_uri: uploadResult.uri,
        original_name: uploadResult.originalName,
        mime_type: audioMimeType,
      });
    }

    // 6. Build multi-modal parts for Gemini
    const geminiParts: GeminiInputParts = {};
    if (textInput) geminiParts.text = textInput;
    if (imageBuffer) {
      geminiParts.imageBase64 = imageBuffer.toString('base64');
      geminiParts.imageMimeType = imageMimeType;
    }
    if (audioBuffer) {
      geminiParts.audioBase64 = audioBuffer.toString('base64');
      geminiParts.audioMimeType = audioMimeType;
    }

    // 7. Send to Gemini 3.1 Pro
    const parsedIntent = await extractIntent(geminiParts);

    // 8. Persist to database
    const savedDoc = await saveIntent(parsedIntent, attachments);

    return NextResponse.json(
      { success: true, document: savedDoc },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    );
  } catch (error) {
    console.error('Ingest Workflow Error:', error);
    // Never leak stack traces to client
    return NextResponse.json(
      { error: 'An internal error occurred while processing your request.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const intents = await getAllIntents();
    return NextResponse.json({ intents });
  } catch (error) {
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }
    await updateIntentStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Database Update Error' }, { status: 500 });
  }
}
