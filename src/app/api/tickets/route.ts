import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tickets = await prisma.ticket.findMany({
    include: { consultant: true, assignedTo: true, createdBy: true },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, description, priority, consultantId, assignedToId } = body;

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description,
      priority: priority || 'MEDIUM',
      consultantId: consultantId || undefined,
      assignedToId: assignedToId || undefined,
      createdById: session.user.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATED_TICKET',
      entityType: 'Ticket',
      entityId: ticket.id,
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}