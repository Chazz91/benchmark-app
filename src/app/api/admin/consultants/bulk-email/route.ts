import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendPersonalizedConsultantEmails } from '@/lib/email';

// POST { consultantIds: string[], subject: string, message: string }
// Include {name} anywhere in the subject or message and it's replaced with each recipient's
// actual first name.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { consultantIds, subject, message } = await request.json();

  if (!Array.isArray(consultantIds) || consultantIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one consultant' }, { status: 400 });
  }
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }

  const consultants = await prisma.consultant.findMany({
    where: { id: { in: consultantIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const withEmail = consultants.filter((c) => !!c.email);
  const withoutEmail = consultants.filter((c) => !c.email);

  if (withEmail.length === 0) {
    return NextResponse.json({ error: 'None of the selected consultants have an email on file' }, { status: 400 });
  }

  const results = await sendPersonalizedConsultantEmails(
    withEmail.map((c) => ({ email: c.email as string, firstName: c.firstName })),
    subject.trim(),
    message.trim(),
    session.user.name || 'Benchmark Engineering',
    session.user.email || 'no-reply@benchmarkeng.ca'
  );

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_EMAILED_CONSULTANTS',
      entityType: 'Consultant',
      entityId: 'bulk',
      metadata: { subject: subject.trim(), recipientCount: succeeded.length, failedCount: failed.length },
    },
  });

  return NextResponse.json({
    sentCount: succeeded.length,
    failed: failed.map((f) => f.email),
    skipped: withoutEmail.map((c) => `${c.firstName} ${c.lastName}`),
  });
}


