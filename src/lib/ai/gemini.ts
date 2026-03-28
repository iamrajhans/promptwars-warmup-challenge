import { GoogleGenAI, Type } from '@google/genai';

// Initialize the modern @google/genai client using an API Key (Google AI Studio)
// It seamlessly adopts GEMINI_API_KEY from the environment
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export interface ParsedIntent {
  raw_text: string;
  intent_summary: string;
  urgency: number; // 1 (Low) to 5 (Critical)
  recommended_action: string;
}

export async function extractIntent(input: string, imageBase64?: string | null): Promise<ParsedIntent> {
  const systemInstruction = `You are Universal Bridge, an expert emergency dispatch routing AI.
You must analyze the user's multi-modal input and objectively categorize the emergency or situation.
Your output must be strictly valid JSON matching the schema parameters exactly. Do not wrap the JSON in Markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: input }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0.1, // Near-zero for deterministic extraction
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent_summary: {
              type: Type.STRING,
              description: "A single, concise sentence summarizing exactly what the situation is."
            },
            urgency: {
              type: Type.INTEGER,
              description: "Integer between 1 (minor/inquiry) and 5 (life-threatening/critical immediately requiring rescue)."
            },
            recommended_action: {
              type: Type.STRING,
              description: "The immediate operational step for the human dispatcher to take."
            }
          },
          required: ["intent_summary", "urgency", "recommended_action"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");

    return {
      raw_text: input,
      intent_summary: parsedData.intent_summary || "Could not parse intent summary.",
      urgency: parsedData.urgency || 1,
      recommended_action: parsedData.recommended_action || "Manual operator review instantly required."
    };

  } catch (error) {
    console.error("Vertex AI Invocation Error:", error);
    throw error;
  }
}
