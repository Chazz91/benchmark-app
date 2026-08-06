import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clients = await prisma.clientCompany.findMany({
    include: { requiredTicketTypes: { include: { ticketType: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const client = await prisma.clientCompany.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  return NextResponse.json({ client }, { status: 201 });
}

