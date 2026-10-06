import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { generatePolishedResume } from '@/lib/polishedResumeGenerator';

export const maxDuration = 300;

// POST - one-time cleanup for "Benchmark Format" resumes generated before the generator
// switched from Word to PDF (mobile browsers have no built-in .docx viewer, so those always
// forced a download instead of opening - see src/lib/polishedResumeGenerator.ts). Regenerates
// each stale .docx from the consultant's current tickets and most recent original resume,
// then repoints the existing resume record at the new PDF - no extra history entry is added.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const staleResumes = await prisma.resume.findMany({
    where: { isFormatted: true, fileName: { endsWith: '.docx' } },
    include: {
      consultant: {
        include: {
          resumes: { orderBy: { createdAt: 'desc' } },
          tickets: { include: { ticketType: true }, orderBy: { ticketType: { label: 'asc' } } },
        },
      },
    },
  });

  const results: { name: string; status: 'updated' | 'skipped' | 'error'; message: string }[] = [];
  let updatedCount = 0;

  for (const resume of staleResumes) {
    const consultant = resume.consultant;
    const name = `${consultant.firstName} ${consultant.lastName}`;
    const sourceResume = consultant.resumes.find((r) => !r.isFormatted && r.rawText);

    if (!sourceResume || !sourceResume.rawText) {
      results.push({ name, status: 'skipped', message: 'No original resume with readable text found' });
      continue;
    }

    try {
      const ticketLabels = consultant.tickets.map((t) => t.ticketType.label);
      const buffer = await generatePolishedResume(sourceResume.rawText, ticketLabels, name, consultant.title || '');

      const fileName = `${name} - Benchmark Resume.pdf`;
      const key = `resumes/${consultant.id}/${Date.now()}-benchmark-format.pdf`;
      const fileUrl = await uploadResumeFile(key, buffer, 'application/pdf');

      await prisma.resume.update({
        where: { id: resume.id },
        data: { fileName, fileUrl, parsedAt: new Date() },
      });

      results.push({ name, status: 'updated', message: 'Regenerated as PDF' });
      updatedCount++;
    } catch (err) {
      results.push({ name, status: 'error', message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BACKFILLED_RESUME_PDF',
      entityType: 'Resume',
      entityId: 'bulk',
      metadata: { checked: staleResumes.length, updatedCount },
    },
  });

  return NextResponse.json({ results, checkedCount: staleResumes.length, updatedCount });
}
