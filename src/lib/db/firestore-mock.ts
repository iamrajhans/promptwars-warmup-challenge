import { ParsedIntent } from '../ai/gemini';

export interface Attachment {
  type: 'image' | 'audio';
  gcs_uri: string;
  public_url: string; // Add public URL for UI rendering
  original_name: string;
  mime_type: string;
}

export interface HistoryEvent {
  timestamp: string;
  action: 'Created' | 'Status Changed';
  metadata: Record<string, unknown>;
}

export interface IntentDocument extends ParsedIntent {
  id: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  timestamp: string;
  attachments: Attachment[];
  history: HistoryEvent[];
}

// In Next.js dev environments, attach to global so it survives HMR
declare global {
  var mockIntents: IntentDocument[] | undefined;
}

const getMockIntents = (): IntentDocument[] => {
  if (!global.mockIntents) {
    global.mockIntents = [];
  }
  return global.mockIntents;
};

export async function saveIntent(
  intent: ParsedIntent,
  attachments: Attachment[] = []
): Promise<IntentDocument> {
  const timestamp = new Date().toISOString();
  const newDoc: IntentDocument = {
    ...intent,
    id: `intent_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    status: 'pending',
    timestamp,
    attachments,
    history: [
      {
        timestamp,
        action: 'Created',
        metadata: { initial_status: 'pending', urgency: intent.urgency },
      },
    ],
  };
  getMockIntents().unshift(newDoc);
  return newDoc;
}

export async function getAllIntents(): Promise<IntentDocument[]> {
  return global.mockIntents || [];
}

export async function updateIntentStatus(
  id: string,
  status: IntentDocument['status']
): Promise<void> {
  const intent = getMockIntents().find((i: IntentDocument) => i.id === id);
  if (intent) {
    const oldStatus = intent.status;
    intent.status = status;
    intent.history.push({
      timestamp: new Date().toISOString(),
      action: 'Status Changed',
      metadata: { from: oldStatus, to: status },
    });
  }
}
