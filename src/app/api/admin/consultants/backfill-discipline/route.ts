import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inferDisciplineFromResume } from '@/lib/resumeParser';

export const maxDuration = 300;

// POST - one-time cleanup for consultants who were imported before discipline was part of
// resume extraction, and are still sitting at the "All / Multiple" default as a result. Goes
// through every consultant at that default, reads EVERY original resume they have on file
// (not just the most recent one - a consultant can have several, and the discipline signal
// might only be clear on one of them), and reclassifies just the discipline field - nothing
// else on the profile is touched.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultants = await prisma.consultant.findMany({
    where: { discipline: 'ALL' },
    include: { resumes: { orderBy: { createdAt: 'desc' } } },
  });

  const results: { name: string; status: 'updated' | 'skipped' | 'error'; message: string }[] = [];
  let updatedCount = 0;

  for (const consultant of consultants) {
    const name = `${consultant.firstName} ${consultant.lastName}`;
    const sourceResumes = consultant.resumes.filter((r) => !r.isFormatted && r.rawText);

    if (sourceResumes.length === 0) {
      results.push({ name, status: 'skipped', message: 'No resume on file to read' });
      continue;
    }

    // Combine every resume's text (most recent first) rather than picking just one - it's a
    // single classification call either way, so there's no reason not to give it everything.
    const combinedText = sourceResumes.map((r) => `--- ${r.fileName} ---\n${r.rawText}`).join('\n\n');

    try {
      const discipline = await inferDisciplineFromResume(combinedText);
      if (!discipline || discipline === 'ALL') {
        results.push({ name, status: 'skipped', message: 'Resume genuinely reads as All / Multiple' });
        continue;
      }

      await prisma.consultant.update({ where: { id: consultant.id }, data: { discipline } });
      results.push({ name, status: 'updated', message: `Set to ${discipline}` });
      updatedCount++;
    } catch (err) {
      results.push({ name, status: 'error', message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BACKFILLED_DISCIPLINE',
      entityType: 'Consultant',
      entityId: 'bulk',
      metadata: { checked: consultants.length, updatedCount },
    },
  });

  return NextResponse.json({ results, checkedCount: consultants.length, updatedCount });
}
