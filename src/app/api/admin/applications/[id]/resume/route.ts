import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getResumeSignedUrl } from '@/lib/storage';

// GET - redirects to a short-lived signed URL for viewing this application's resume.
// The file itself lives in a private R2 bucket, so we never expose a permanent public link.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const application = await prisma.application.findUnique({ where: { id: params.id } });
  if (!application || !application.resumeUrl) {
    return NextResponse.json({ error: 'No resume on file' }, { status: 404 });
  }

  const signedUrl = await getResumeSignedUrl(application.resumeUrl);
  return NextResponse.redirect(signedUrl);
}