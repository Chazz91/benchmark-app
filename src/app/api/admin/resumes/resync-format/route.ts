import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - lists every consultant who has an existing "Benchmark Format" resume, so the admin UI
// can regenerate each one with the current template (font, title rule, core tickets, header
// layout) - unlike the PDF backfill above, this isn't scoped to stale .docx-only resumes; it
// catches anyone whose Benchmark resume was generated before a later formatting change.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultants = await prisma.consultant.findMany({
    where: { resumes: { some: { isFormatted: true } } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const items = consultants.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));

  return NextResponse.json({ items });
}
