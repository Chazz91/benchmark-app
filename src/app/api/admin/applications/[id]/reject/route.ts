import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendApplicationRejectedEmail } from '@/lib/email';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reason } = await req.json().catch(() => ({ reason: undefined }));

  const application = await prisma.application.findUnique({ where: { id: params.id } });
  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (application.status !== 'PENDING') {
    return NextResponse.json({ error: 'Application already reviewed' }, { status: 400 });
  }

  await prisma.application.update({
    where: { id: application.id },
    data: {
      status: 'REJECTED',
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });

  try {
    await sendApplicationRejectedEmail(application.email, application.firstName, reason);
  } catch (err) {
    console.error('Failed to send rejection email:', err);
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'REJECTED_APPLICATION',
      entityType: 'Application',
      entityId: application.id,
    },
  });

  return NextResponse.json({ success: true });
}

