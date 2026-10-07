import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST { ticketTypeId, issueDate, expiryDate?, noExpiry? } - adds (or renews, if this
// consultant already has one of this type) a ticket directly, with no document required.
// A photo/PDF upload is still the faster path when you have one, but sometimes you're just
// told the dates over the phone, or re-entering one that was deleted by mistake - this is the
// manual fallback for both.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { ticketTypeId, issueDate, expiryDate, noExpiry } = (await request.json()) as {
    ticketTypeId?: string;
    issueDate?: string;
    expiryDate?: string | null;
    noExpiry?: boolean;
  };

  if (!ticketTypeId || !issueDate) {
    return NextResponse.json({ error: 'ticketTypeId and issueDate are required' }, { status: 400 });
  }
  if (!noExpiry && !expiryDate) {
    return NextResponse.json(
      { error: 'expiryDate is required unless this ticket has no expiry' },
      { status: 400 }
    );
  }

  const ticketType = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
  if (!ticketType) return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });

  const resolvedExpiryDate = noExpiry ? null : new Date(expiryDate as string);

  // One ticket record per consultant+ticketType, same as every other entry point (self-service,
  // photo upload) - adding one for a type that already exists on file renews it instead of
  // creating a duplicate.
  const existing = await prisma.ticket.findFirst({
    where: { consultantId: consultant.id, ticketTypeId },
  });

  const ticket = existing
    ? await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          issueDate: new Date(issueDate),
          expiryDate: resolvedExpiryDate,
          expiryNoticeSentAt: null,
          expiryNotice30SentAt: null,
        },
        include: { ticketType: true },
      })
    : await prisma.ticket.create({
        data: {
          consultantId: consultant.id,
          ticketTypeId,
          issueDate: new Date(issueDate),
          expiryDate: resolvedExpiryDate,
        },
        include: { ticketType: true },
      });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: existing ? 'UPDATED_TICKET' : 'ADDED_TICKET',
      entityType: 'Ticket',
      entityId: ticket.id,
      metadata: { consultantId: consultant.id, ticketType: ticketType.label },
    },
  });

  return NextResponse.json({ ticket }, { status: existing ? 200 : 201 });
}
