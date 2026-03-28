import { NextResponse } from 'next/server';
import { extractIntent } from '@/lib/ai/gemini';
import { saveIntent, getAllIntents, updateIntentStatus } from '@/lib/db/firestore-mock';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { input, image } = body;

    if (!input) {
      return NextResponse.json({ error: 'Input text is required' }, { status: 400 });
    }

    // 1. Send unstructured data to Gemini 3.1 Pro Mock
    const parsedIntent = await extractIntent(input, image);

    // 2. Save securely to Firestore Mock (which operators will read)
    const savedDoc = await saveIntent(parsedIntent);

    return NextResponse.json({ success: true, document: savedDoc });
  } catch (error) {
    console.error('Ingest Workflow Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET serves as our real-time mock since we don't have the active Firestore snapshot SDK installed
export async function GET() {
  try {
    const intents = await getAllIntents();
    return NextResponse.json({ intents });
  } catch (error) {
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }
}

// PATCH allows operators to acknowledge intents
export async function PATCH(request: Request) {
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
