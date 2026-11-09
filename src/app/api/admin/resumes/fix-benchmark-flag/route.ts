import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { looksLikeBenchmarkFormat } from '@/lib/resumeFormatting';

// POST - one-time cleanup for resumes uploaded before new uploads started auto-detecting a
// Benchmark-formatted file by name. Finds every resume still flagged isFormatted: false whose
// file name matches our naming convention (e.g. "<Name> - Benchmark Resume.pdf", pulled in
// from the company's shared drive) and flips it to isFormatted: true, so it's hidden from the
// consultant themselves the same way every other Benchmark-format resume already is. Safe to
// run more than once - already-flagged resumes are simply excluded from the query.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const candidates = await prisma.resume.findMany({
    where: { isFormatted: false },
    include: { consultant: { select: { firstName: true, lastName: true } } },
  });

  const toFix = candidates.filter((r) => looksLikeBenchmarkFormat(r.fileName));

  if (toFix.length > 0) {
    await prisma.resume.updateMany({
      where: { id: { in: toFix.map((r) => r.id) } },
      data: { isFormatted: true },
    });
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'FIXED_BENCHMARK_RESUME_FLAG',
      entityType: 'Resume',
      entityId: 'bulk',
      metadata: { checkedCount: candidates.length, fixedCount: toFix.length },
    },
  });

  return NextResponse.json({
    checkedCount: candidates.length,
    fixedCount: toFix.length,
    fixed: toFix.map((r) => ({ name: `${r.consultant.firstName} ${r.consultant.lastName}`, fileName: r.fileName })),
  });
}
