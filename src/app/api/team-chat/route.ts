import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';

const STAFF_ROLES = ['ADMIN', 'RECRUITER', 'VIEWER'];

// GET ?since=<ISO timestamp> - returns messages after that point (or the most recent 100 if
// no "since" given). Polling this every few seconds gives a near-live chat feel without
// needing a WebSocket server.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');

  const messages = await prisma.teamMessage.findMany({
    where: since ? { createdAt: { gt: new Date(since) } } : undefined,
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
    take: since ? undefined : 100,
  });

  return NextResponse.json({ messages });
}

// POST multipart/form-data: { body: string, file?: File }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const body = (formData.get('body') as string | null) || '';
  const file = formData.get('file') as File | null;

  if (!body.trim() && !file) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
  }

  let attachmentUrl: string | undefined;
  let attachmentFileName: string | undefined;

  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `team-chat/${Date.now()}-${file.name}`;
    attachmentUrl = await uploadResumeFile(key, buffer, file.type);
    attachmentFileName = file.name;
  }

  const message = await prisma.teamMessage.create({
    data: {
      senderId: session.user.id,
      body: body.trim() || (attachmentFileName ? `Sent a file: ${attachmentFileName}` : ''),
      attachmentUrl,
      attachmentFileName,
    },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message }, { status: 201 });
}

