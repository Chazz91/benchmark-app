import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/keywords?type=FORMATION  (type optional)
// Public on purpose - the Apply page needs this list for anonymous applicants who aren't
// logged in yet. It's just formation/skill/cert names, nothing sensitive.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const keywords = await prisma.keyword.findMany({
    where: type ? { type: type as any } : undefined,
    orderBy: { label: 'asc' },
  });

  return NextResponse.json({ keywords });
}

// POST /api/keywords  { label, type }  -- add a new keyword to the taxonomy (admin/recruiter)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { label, type } = body;

  if (!label || !type) {
    return NextResponse.json({ error: 'label and type are required' }, { status: 400 });
  }

  const keyword = await prisma.keyword.upsert({
    where: { label_type: { label, type } },
    update: {},
    create: { label, type },
  });

  return NextResponse.json({ keyword });
}

