import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/consultants?q=search&status=ACTIVE&keywordIds=id1,id2&matchMode=all|any
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || undefined;
  const status = searchParams.get('status') || undefined;
  const discipline = searchParams.get('discipline') || undefined;
  const keywordIdsParam = searchParams.get('keywordIds');
  const matchMode = searchParams.get('matchMode') === 'all' ? 'all' : 'any';

  const keywordIds = keywordIdsParam ? keywordIdsParam.split(',').filter(Boolean) : [];

  const where: any = {
    ...(status ? { status } : {}),
    ...(discipline ? { discipline } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { location: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  if (keywordIds.length > 0) {
    if (matchMode === 'all') {
      // consultant must have ALL selected keywords
      where.AND = keywordIds.map((id) => ({
        keywords: { some: { keywordId: id } },
      }));
    } else {
      // consultant must have ANY of the selected keywords
      where.keywords = { some: { keywordId: { in: keywordIds } } };
    }
  }

  const consultants = await prisma.consultant.findMany({
    where,
    include: {
      keywords: { include: { keyword: true } },
      currentClient: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 100,
  });

  return NextResponse.json({ consultants });
}

// POST /api/consultants - create a new consultant record
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { firstName, lastName, email, phone, title, yearsExperience, location, status, summary } = body;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'firstName and lastName are required' }, { status: 400 });
  }

  const consultant = await prisma.consultant.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      title,
      yearsExperience,
      location,
      status: status || 'ACTIVE',
      summary,
      createdById: session.user.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATED_CONSULTANT',
      entityType: 'Consultant',
      entityId: consultant.id,
    },
  });

  return NextResponse.json({ consultant }, { status: 201 });
}