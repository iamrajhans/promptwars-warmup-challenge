export interface ParsedIntent {
  raw_text: string;
  intent_summary: string;
  urgency: number; // 1 (Low) to 5 (Critical)
  recommended_action: string;
}

export async function extractIntent(input: string, imageBase64?: string | null): Promise<ParsedIntent> {
  // Simulate Gemini 3.1 Pro reasoning delay (3-4 seconds SLA)
  await new Promise(resolve => setTimeout(resolve, 3500));
  
  // Basic mock reasoning based on heuristics
  const isCritical = input.toLowerCase().includes('emergency') || 
                     input.toLowerCase().includes('heart') || 
                     input.toLowerCase().includes('accident') ||
                     input.toLowerCase().includes('fire');
  
  return {
    raw_text: input,
    intent_summary: isCritical 
      ? 'Critical emergency reported requiring immediate localized dispatch.'
      : 'General assistance or inquiry request logged for operator review.',
    urgency: isCritical ? 5 : 2,
    recommended_action: isCritical ? 'Dispatch Emergency Services to location' : 'Queue for standard triage'
  };
}
