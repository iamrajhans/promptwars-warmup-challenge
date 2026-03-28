import { describe, it, expect, beforeEach } from 'vitest';
import { saveIntent, getAllIntents, updateIntentStatus } from '../firestore-mock';

// Helper intent factory
const makeIntent = (overrides = {}) => ({
  raw_text: 'Test emergency',
  intent_summary: 'Test situation',
  urgency: 2,
  recommended_action: 'Assess',
  input_modalities: ['text'],
  ...overrides,
});

beforeEach(() => {
  const globalAny: any = global;
  // Reset global store for isolation (covers the `if (!globalAny.mockIntents)` branch = false)
  globalAny.mockIntents = [];
});

describe('saveIntent', () => {
  it('should save and return a document with generated ID, pending status, and timestamp', async () => {
    const doc = await saveIntent(makeIntent());

    expect(doc.id).toBeDefined();
    expect(doc.id).toMatch(/^intent_/);
    expect(doc.status).toBe('pending');
    expect(doc.timestamp).toBeDefined();
    expect(new Date(doc.timestamp).getTime()).not.toBeNaN();
    expect(doc.attachments).toEqual([]);
  });

  it('should spread all intent fields into the document', async () => {
    const intent = makeIntent({ intent_summary: 'Car crash', urgency: 4 });
    const doc = await saveIntent(intent);

    expect(doc.intent_summary).toBe('Car crash');
    expect(doc.urgency).toBe(4);
    expect(doc.raw_text).toBe('Test emergency');
  });

  it('should save with attachments when provided', async () => {
    const attachments = [
      { type: 'image' as const, gcs_uri: 'gs://bucket/img.jpg', original_name: 'crash.jpg', mime_type: 'image/jpeg' },
      { type: 'audio' as const, gcs_uri: 'gs://bucket/audio.webm', original_name: 'voice.webm', mime_type: 'audio/webm' },
    ];
    const doc = await saveIntent(makeIntent(), attachments);

    expect(doc.attachments).toHaveLength(2);
    expect(doc.attachments[0].gcs_uri).toBe('gs://bucket/img.jpg');
    expect(doc.attachments[1].type).toBe('audio');
  });

  it('should prepend new intents (most recent first)', async () => {
    await saveIntent(makeIntent({ intent_summary: 'First' }));
    await saveIntent(makeIntent({ intent_summary: 'Second' }));

    const all = await getAllIntents();
    expect(all[0].intent_summary).toBe('Second');
    expect(all[1].intent_summary).toBe('First');
  });

  it('should generate unique IDs for each document', async () => {
    const doc1 = await saveIntent(makeIntent());
    const doc2 = await saveIntent(makeIntent());

    expect(doc1.id).not.toBe(doc2.id);
  });
});

describe('getAllIntents', () => {
  it('should return empty array when store has no intents', async () => {
    // This covers the `|| []` branch when mockIntents is set to empty
    const all = await getAllIntents();
    expect(all).toEqual([]);
  });

  it('should return all saved intents', async () => {
    await saveIntent(makeIntent({ intent_summary: 'A' }));
    await saveIntent(makeIntent({ intent_summary: 'B' }));

    const all = await getAllIntents();
    expect(all).toHaveLength(2);
  });

  it('should return the store by reference (reflects updates)', async () => {
    await saveIntent(makeIntent());
    const all1 = await getAllIntents();
    expect(all1).toHaveLength(1);

    await saveIntent(makeIntent());
    const all2 = await getAllIntents();
    expect(all2).toHaveLength(2);
  });
});

describe('updateIntentStatus', () => {
  it('should update an intent to acknowledged', async () => {
    const doc = await saveIntent(makeIntent());
    await updateIntentStatus(doc.id, 'acknowledged');

    const all = await getAllIntents();
    expect(all[0].status).toBe('acknowledged');
  });

  it('should update an intent to resolved', async () => {
    const doc = await saveIntent(makeIntent());
    await updateIntentStatus(doc.id, 'resolved');

    const all = await getAllIntents();
    expect(all[0].status).toBe('resolved');
  });

  it('should only update the targeted intent', async () => {
    const doc1 = await saveIntent(makeIntent({ intent_summary: 'A' }));
    const doc2 = await saveIntent(makeIntent({ intent_summary: 'B' }));

    await updateIntentStatus(doc1.id, 'acknowledged');

    const all = await getAllIntents();
    const updated = all.find(i => i.id === doc1.id);
    const unchanged = all.find(i => i.id === doc2.id);

    expect(updated!.status).toBe('acknowledged');
    expect(unchanged!.status).toBe('pending');
  });

  it('should silently handle non-existent IDs without throwing', async () => {
    await expect(updateIntentStatus('nonexistent_id', 'acknowledged')).resolves.toBeUndefined();
  });
});
