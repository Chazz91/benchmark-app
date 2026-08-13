import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const application = await prisma.application.findUnique({
    where: { id: params.id },
    include: { keywords: { include: { keyword: true } } },
  });

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (application.status !== 'PENDING') {
    return NextResponse.json({ error: 'Application already reviewed' }, { status: 400 });
  }

  // 1. Create the Consultant record from the application
  const consultant = await prisma.consultant.create({
    data: {
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone,
      discipline: application.discipline,
      hasCanadianPassport: application.hasCanadianPassport,
      hasUSPassport: application.hasUSPassport,
      yearsExperience: application.yearsExperience,
      title: application.title,
      summary: application.parsedSummary,
      otherFormationNotes: application.otherFormationNotes,
      status: 'ACTIVE',
      applicationId: application.id,
      createdById: session.user.id,
    },
  });

  // 2. Copy the application's parsed keywords onto the new consultant
  for (const ak of application.keywords) {
    await prisma.consultantKeyword.create({
      data: {
        consultantId: consultant.id,
        keywordId: ak.keywordId,
        source: 'PARSED',
        confidence: ak.confidence,
      },
    });
  }

  // 3. Copy the resume record too, if one was submitted
  if (application.resumeUrl && application.resumeFileName) {
    await prisma.resume.create({
      data: {
        consultantId: consultant.id,
        fileName: application.resumeFileName,
        fileUrl: application.resumeUrl,
        rawText: application.rawText,
        parsedAt: new Date(),
      },
    });
  }

  // 4. Mark the application accepted
  await prisma.application.update({
    where: { id: application.id },
    data: { status: 'ACCEPTED', reviewedById: session.user.id, reviewedAt: new Date() },
  });

  // 5. Create an invite token (valid 7 days) and email it to the applicant
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.inviteToken.create({
    data: { token, consultantId: consultant.id, expiresAt },
  });

  try {
    await sendInviteEmail(application.email, application.firstName, token);
  } catch (err) {
    console.error('Failed to send invite email:', err);
    // Don't fail the request - admin can resend manually if needed
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'ACCEPTED_APPLICATION',
      entityType: 'Application',
      entityId: application.id,
      metadata: { consultantId: consultant.id },
    },
  });

  return NextResponse.json({ consultant });
}