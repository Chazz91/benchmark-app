import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST - returns a working signup link for this consultant, creating a fresh one if needed.
// This is the manual fallback for when the invite email doesn't arrive (email not set up
// yet, delivery failure, wrong address, etc.) - staff can copy/share this link directly.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: params.id },
    include: { inviteToken: true },
  });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (consultant.userId) {
    return NextResponse.json(
      { error: 'This consultant already has a login - no invite link needed' },
      { status: 400 }
    );
  }

  const now = new Date();

  // Reuse the existing token if it's still valid and unused
  if (consultant.inviteToken && !consultant.inviteToken.usedAt && consultant.inviteToken.expiresAt > now) {
    return NextResponse.json({ token: consultant.inviteToken.token });
  }

  // Otherwise replace it with a fresh one (valid 7 days)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.inviteToken.upsert({
    where: { consultantId: consultant.id },
    update: { token, expiresAt, usedAt: null },
    create: { consultantId: consultant.id, token, expiresAt },
  });

  return NextResponse.json({ token });
}