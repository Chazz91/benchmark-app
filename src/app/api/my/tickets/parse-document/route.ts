import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseTicketDocument } from '@/lib/ticketDocumentParser';

// POST multipart/form-data: { file }
// Consultant-only. Reads a photo/scan of one or more certification cards and returns what it
// detected (name, issue date, expiry date) for the consultant to review and confirm before
// anything is actually saved - AI-read dates can be wrong, so nothing is auto-saved here.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const detected = await parseTicketDocument(buffer, file.type);
    return NextResponse.json({ detected });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

