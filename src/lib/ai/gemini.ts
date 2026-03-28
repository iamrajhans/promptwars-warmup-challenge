import { GoogleGenAI, Type } from '@google/genai';

// Initialize the @google/genai client using an API Key (Google AI Studio)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface ParsedIntent {
  raw_text: string;
  intent_summary: string;
  urgency: number; // 1 (Low) to 5 (Critical)
  recommended_action: string;
  input_modalities: string[]; // Which modalities were used
}

export interface GeminiInputParts {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * Extract structured intent from multi-modal input via Gemini 3.1 Pro.
 * Supports text, image (inline base64), and audio (inline base64).
 */
export async function extractIntent(parts: GeminiInputParts): Promise<ParsedIntent> {
  const systemInstruction = `You are Universal Bridge, an expert emergency dispatch routing AI.
You analyze multi-modal inputs (text, images, audio transcriptions) to objectively categorize situations.
For images: describe what you see and assess any emergency or situation depicted.
For audio: transcribe and interpret the spoken content.
For text: parse the natural language description.
Combine all available modalities to produce the most accurate assessment.
Your output must be strictly valid JSON matching the schema parameters exactly.`;

  // Build content parts dynamically based on available modalities
  const contentParts: GeminiPart[] = [];
  const modalities: string[] = [];

  if (parts.text) {
    contentParts.push({ text: parts.text });
    modalities.push('text');
  }

  if (parts.imageBase64 && parts.imageMimeType) {
    contentParts.push({
      inlineData: {
        mimeType: parts.imageMimeType,
        data: parts.imageBase64,
      }
    });
    modalities.push('image');
    // Add context instruction for image
    if (!parts.text) {
      contentParts.unshift({ text: 'Analyze this image and determine if there is an emergency or situation that requires attention.' });
    }
  }

  if (parts.audioBase64 && parts.audioMimeType) {
    contentParts.push({
      inlineData: {
        mimeType: parts.audioMimeType,
        data: parts.audioBase64,
      }
    });
    modalities.push('audio');
    if (!parts.text && !parts.imageBase64) {
      contentParts.unshift({ text: 'Transcribe and analyze this audio recording to determine if there is an emergency or situation.' });
    }
  }

  if (contentParts.length === 0) {
    throw new Error('At least one input modality (text, image, or audio) is required.');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ role: 'user', parts: contentParts }],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent_summary: {
              type: Type.STRING,
              description: 'A single, concise sentence summarizing exactly what the situation is.'
            },
            urgency: {
              type: Type.INTEGER,
              description: 'Integer between 1 (minor/inquiry) and 5 (life-threatening/critical immediately requiring rescue).'
            },
            recommended_action: {
              type: Type.STRING,
              description: 'The immediate operational step for the human dispatcher to take.'
            }
          },
          required: ['intent_summary', 'urgency', 'recommended_action']
        }
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    const rawText = parts.text || `[${modalities.join(' + ')} input]`;

    return {
      raw_text: rawText,
      intent_summary: parsedData.intent_summary || 'Could not parse intent summary.',
      urgency: parsedData.urgency || 1,
      recommended_action: parsedData.recommended_action || 'Manual operator review required.',
      input_modalities: modalities,
    };
  } catch (error) {
    console.error('Gemini Invocation Error:', error);
    throw error;
  }
}
