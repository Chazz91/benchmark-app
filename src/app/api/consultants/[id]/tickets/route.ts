import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';

// POST multipart/form-data: { ticketTypeId, issueDate, expiryDate?, noExpiry?, file? } - adds
// (or renews, if this consultant already has one of this type) a ticket directly, with no
// document required. A photo/PDF upload through the AI-parsed uploader above is still the
// faster path for a certification card, but some documents - a WCB clearance letter, for
// instance - aren't a "certification" the parser is tuned to recognize, or you're just told
// the dates over the phone, or re-entering one that was deleted by mistake. The optional file
// here is attached as-is, with no AI reading of it.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await request.formData();
  const ticketTypeId = formData.get('ticketTypeId') as string | null;
  const issueDate = formData.get('issueDate') as string | null;
  const expiryDate = formData.get('expiryDate') as string | null;
  const noExpiry = formData.get('noExpiry') === 'true';
  const file = formData.get('file') as File | null;

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

  let documentUrl: string | undefined;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `ticket-documents/${consultant.id}/${Date.now()}-${file.name}`;
    documentUrl = await uploadResumeFile(key, buffer, file.type);
  }

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
          documentUrl: documentUrl || existing.documentUrl,
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
          documentUrl,
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
