import { ParsedIntent } from "../ai/gemini-mock";

export interface IntentDocument extends ParsedIntent {
  id: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  timestamp: string;
}

// In Next.js dev environments, we attach the mock DB to global so it survives HMR
const globalAny: any = global;
if (!globalAny.mockIntents) {
  globalAny.mockIntents = [];
}

export async function saveIntent(intent: ParsedIntent): Promise<IntentDocument> {
  const newDoc: IntentDocument = {
    ...intent,
    id: `intent_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  // Push to top of feed
  globalAny.mockIntents.unshift(newDoc);
  return newDoc;
}

export async function getAllIntents(): Promise<IntentDocument[]> {
  return globalAny.mockIntents || [];
}

export async function updateIntentStatus(id: string, status: IntentDocument['status']): Promise<void> {
  const intent = globalAny.mockIntents.find((i: IntentDocument) => i.id === id);
  if (intent) {
    intent.status = status;
  }
}
