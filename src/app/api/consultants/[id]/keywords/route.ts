import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST body: { keywordId: string } -- attach an existing keyword to this consultant
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { keywordId } = await req.json();
  if (!keywordId) return NextResponse.json({ error: 'keywordId required' }, { status: 400 });

  const link = await prisma.consultantKeyword.upsert({
    where: { consultantId_keywordId: { consultantId: params.id, keywordId } },
    update: {},
    create: { consultantId: params.id, keywordId, source: 'MANUAL' },
  });

  return NextResponse.json({ link });
}

// DELETE body: { keywordId: string } -- remove a keyword from this consultant
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { keywordId } = await req.json();
  if (!keywordId) return NextResponse.json({ error: 'keywordId required' }, { status: 400 });

  await prisma.consultantKeyword.delete({
    where: { consultantId_keywordId: { consultantId: params.id, keywordId } },
  });

  return NextResponse.json({ success: true });
}