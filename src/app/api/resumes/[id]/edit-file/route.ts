import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getResumeSignedUrl } from '@/lib/storage';

// GET - redirects to a short-lived signed URL for the editable Word copy of a formatted
// resume (see src/lib/polishedResumeGenerator.ts), generated alongside the PDF so it can be
// downloaded and edited directly in Word/Google Docs. Same access rules as /view.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resume = await prisma.resume.findUnique({
    where: { id: params.id },
    include: { consultant: true },
  });
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isStaff = ['ADMIN', 'RECRUITER', 'VIEWER'].includes(session.user.role);
  const isOwner = session.user.role === 'CONSULTANT' && resume.consultant.userId === session.user.id;

  if (!isStaff && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!resume.editableFileUrl || !resume.editableFileName) {
    return NextResponse.json({ error: 'No editable copy available for this resume' }, { status: 404 });
  }

  const signedUrl = await getResumeSignedUrl(resume.editableFileUrl, resume.editableFileName);
  return NextResponse.redirect(signedUrl);
}
