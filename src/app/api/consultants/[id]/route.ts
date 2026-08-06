import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: params.id },
    include: {
      keywords: { include: { keyword: true } },
      currentClient: true,
      resumes: true,
      tickets: { include: { ticketType: true }, orderBy: { expiryDate: 'asc' } },
      evaluations: { include: { evaluator: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ consultant });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const consultant = await prisma.consultant.update({
    where: { id: params.id },
    data: body,
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATED_CONSULTANT',
      entityType: 'Consultant',
      entityId: consultant.id,
      metadata: body,
    },
  });

  return NextResponse.json({ consultant });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.consultant.delete({ where: { id: params.id } });

  // If they'd signed up for their own login, remove that account too - otherwise it's an
  // orphaned CONSULTANT-role login with no profile behind it.
  if (consultant.userId) {
    await prisma.user.delete({ where: { id: consultant.userId } }).catch(() => {
      // If this fails for any reason, the consultant record is already gone either way
    });
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETED_CONSULTANT',
      entityType: 'Consultant',
      entityId: params.id,
    },
  });

  return NextResponse.json({ success: true });
}

