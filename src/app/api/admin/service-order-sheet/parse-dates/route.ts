import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractTextFromFile, extractServiceOrderDates } from '@/lib/resumeParser';

// POST multipart/form-data: { file } - reads a service order sheet and returns whatever
// start/end dates it can find in the document, so the upload form can pre-fill them. Doesn't
// save anything; the actual upload is a separate call once staff confirms the dates.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(buffer, file.type);
    const dates = await extractServiceOrderDates(text);
    return NextResponse.json(dates);
  } catch (err) {
    // Non-fatal - the form just falls back to blank dates for manual entry
    console.error('Failed to auto-extract service order dates:', err);
    return NextResponse.json({ startDate: null, endDate: null });
  }
}
