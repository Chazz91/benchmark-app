import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH { issueDate, expiryDate?, noExpiry? } - admin/recruiter correcting a ticket's dates
// (e.g. a typo'd expiry, or a renewal entered on the consultant's behalf).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const { issueDate, expiryDate, noExpiry } = body as {
    issueDate?: string;
    expiryDate?: string | null;
    noExpiry?: boolean;
  };

  if (!issueDate) {
    return NextResponse.json({ error: 'issueDate is required' }, { status: 400 });
  }
  if (!noExpiry && !expiryDate) {
    return NextResponse.json(
      { error: 'expiryDate is required unless this ticket has no expiry' },
      { status: 400 }
    );
  }

  const resolvedExpiryDate = noExpiry ? null : new Date(expiryDate as string);

  const updated = await prisma.ticket.update({
    where: { id: params.id },
    data: {
      issueDate: new Date(issueDate),
      expiryDate: resolvedExpiryDate,
      // dates changed - let a fresh expiry email go out if the new date warrants one
      expiryNoticeSentAt: null,
      expiryNotice30SentAt: null,
    },
    include: { ticketType: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATED_TICKET',
      entityType: 'Ticket',
      entityId: updated.id,
      metadata: { issueDate, expiryDate: resolvedExpiryDate },
    },
  });

  return NextResponse.json({ ticket: updated });
}

// DELETE - removes a ticket record entirely (e.g. it was added by mistake, or for the wrong
// consultant/ticket type).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.ticket.delete({ where: { id: params.id } });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETED_TICKET',
      entityType: 'Ticket',
      entityId: params.id,
    },
  });

  return NextResponse.json({ success: true });
}
