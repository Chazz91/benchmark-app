import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - lists "Benchmark Format" resumes still generated as the old Word format, for the
// admin UI to work through one at a time (see POST below for why it's split this way).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // A Benchmark-format .docx only needs backfilling if its consultant has no Benchmark-format
  // .pdf at all - every generation now produces a PDF+docx pair together (the docx purely for
  // downloading and editing in Word), so a consultant who already has a pdf is done, not stale.
  const staleResumes = await prisma.resume.findMany({
    where: {
      isFormatted: true,
      fileName: { endsWith: '.docx' },
      consultant: { resumes: { none: { isFormatted: true, fileName: { endsWith: '.pdf' } } } },
    },
    include: { consultant: { select: { firstName: true, lastName: true } } },
  });

  const items = staleResumes.map((r) => ({
    id: r.id,
    name: `${r.consultant.firstName} ${r.consultant.lastName}`,
  }));

  return NextResponse.json({ items });
}
