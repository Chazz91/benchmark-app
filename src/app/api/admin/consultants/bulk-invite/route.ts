import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendConsultantProfileInviteEmail } from '@/lib/email';

// POST { consultantIds: string[] } - sends a profile-setup invite email to each selected
// consultant who doesn't have a login yet, so staff don't have to open each profile and hit
// "Copy invite link" one at a time. Reuses the same token logic as that single-consultant
// route: an existing unused, unexpired token is reused rather than generating a fresh one.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { consultantIds } = await request.json();
  if (!Array.isArray(consultantIds) || consultantIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one consultant' }, { status: 400 });
  }

  const consultants = await prisma.consultant.findMany({
    where: { id: { in: consultantIds } },
    include: { inviteToken: true },
  });

  const now = new Date();
  const results: { name: string; status: 'sent' | 'skipped' | 'error'; message: string }[] = [];
  let sentCount = 0;

  for (const consultant of consultants) {
    const name = `${consultant.firstName} ${consultant.lastName}`;

    if (consultant.userId) {
      results.push({ name, status: 'skipped', message: 'Already has a login' });
      continue;
    }
    if (!consultant.email) {
      results.push({ name, status: 'skipped', message: 'No email on file' });
      continue;
    }

    try {
      let token: string;
      if (consultant.inviteToken && !consultant.inviteToken.usedAt && consultant.inviteToken.expiresAt > now) {
        token = consultant.inviteToken.token;
      } else {
        token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await prisma.inviteToken.upsert({
          where: { consultantId: consultant.id },
          update: { token, expiresAt, usedAt: null },
          create: { consultantId: consultant.id, token, expiresAt },
        });
      }

      await sendConsultantProfileInviteEmail(consultant.email, consultant.firstName, token);
      results.push({ name, status: 'sent', message: `Sent to ${consultant.email}` });
      sentCount++;
    } catch (err) {
      results.push({ name, status: 'error', message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_SENT_INVITE_LINKS',
      entityType: 'Consultant',
      entityId: 'bulk',
      metadata: { sentCount, totalSelected: consultantIds.length },
    },
  });

  return NextResponse.json({ results, sentCount });
}
