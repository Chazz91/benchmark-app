import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { regenerateConsultantSummary } from '@/lib/resumeParser';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: params.id },
    include: { resumes: { orderBy: { createdAt: 'desc' } } },
  });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sourceResume = consultant.resumes.find((r) => !r.isFormatted && r.rawText);
  if (!sourceResume || !sourceResume.rawText) {
    return NextResponse.json(
      { error: 'No original resume with readable text found for this consultant' },
      { status: 400 }
    );
  }

  try {
    const summary = await regenerateConsultantSummary(
      sourceResume.rawText,
      consultant.firstName,
      consultant.lastName,
      consultant.title
    );
    await prisma.consultant.update({ where: { id: consultant.id }, data: { summary } });
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}