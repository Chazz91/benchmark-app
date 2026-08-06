import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticketTypes = await prisma.ticketType.findMany({ orderBy: { label: 'asc' } });
  return NextResponse.json({ ticketTypes });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { label, discipline, validMonths, hasExpiry } = await request.json();
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 });

  const ticketType = await prisma.ticketType.upsert({
    where: { label },
    update: { discipline, validMonths, hasExpiry: hasExpiry ?? true },
    create: {
      label,
      discipline: discipline || 'ALL',
      validMonths: validMonths || 36,
      hasExpiry: hasExpiry ?? true,
    },
  });

  return NextResponse.json({ ticketType }, { status: 201 });
}

