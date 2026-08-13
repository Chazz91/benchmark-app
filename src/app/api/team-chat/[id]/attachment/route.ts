import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getResumeSignedUrl } from '@/lib/storage';

const STAFF_ROLES = ['ADMIN', 'RECRUITER', 'VIEWER'];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const message = await prisma.teamMessage.findUnique({ where: { id: params.id } });
  if (!message || !message.attachmentUrl) {
    return NextResponse.json({ error: 'No attachment on this message' }, { status: 404 });
  }

  const signedUrl = await getResumeSignedUrl(message.attachmentUrl);
  return NextResponse.redirect(signedUrl);
}