import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { sendTicketUploadedAlertEmail } from '@/lib/email';

// Helper: find the logged-in consultant record for the current session
async function getOwnConsultant(userId: string) {
  return prisma.consultant.findUnique({ where: { userId }, include: { currentClient: true } });
}

// GET - returns the general required ticket types for this consultant's discipline, plus
// their existing tickets. This is one common list for everyone (the client-specific
// requirement setup still exists in Admin > Clients for future use, but isn't applied here
// right now - most oil & gas companies need roughly the same core tickets anyway).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await getOwnConsultant(session.user.id);
  if (!consultant) return NextResponse.json({ error: 'No consultant profile found' }, { status: 404 });

  const requiredTypes = await prisma.ticketType.findMany({
    where: { OR: [{ discipline: consultant.discipline }, { discipline: 'ALL' }] },
    orderBy: { label: 'asc' },
  });

  const tickets = await prisma.ticket.findMany({
    where: { consultantId: consultant.id },
    include: { ticketType: true },
    orderBy: { expiryDate: 'asc' },
  });

  return NextResponse.json({ requiredTypes, tickets, consultant });
}

// POST multipart/form-data: { ticketTypeId, issueDate, expiryDate, file? }
// Creates or updates (same ticketType => update) this consultant's own ticket record
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await getOwnConsultant(session.user.id);
  if (!consultant) return NextResponse.json({ error: 'No consultant profile found' }, { status: 404 });

  const formData = await request.formData();
  const ticketTypeId = formData.get('ticketTypeId') as string;
  const issueDate = formData.get('issueDate') as string;
  const expiryDate = formData.get('expiryDate') as string | null;
  const noExpiry = formData.get('noExpiry') === 'true';
  const file = formData.get('file') as File | null;

  if (!ticketTypeId || !issueDate) {
    return NextResponse.json({ error: 'ticketTypeId and issueDate are required' }, { status: 400 });
  }

  const ticketType = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
  if (!ticketType) return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 });

  // Whether THIS specific ticket has an expiry is a per-ticket choice, not locked to the
  // type's usual default - e.g. most consultants' WHMIS expires, but some genuinely don't.
  if (!noExpiry && !expiryDate) {
    return NextResponse.json(
      { error: 'expiryDate is required unless this ticket has no expiry' },
      { status: 400 }
    );
  }

  let documentUrl: string | undefined;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `ticket-documents/${consultant.id}/${Date.now()}-${file.name}`;
    documentUrl = await uploadResumeFile(key, buffer, file.type);
  }

  // one ticket record per consultant+ticketType - renewing updates the existing one
  const existing = await prisma.ticket.findFirst({
    where: { consultantId: consultant.id, ticketTypeId },
  });

  const resolvedExpiryDate = noExpiry ? null : expiryDate ? new Date(expiryDate) : null;

  const ticket = existing
    ? await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          issueDate: new Date(issueDate),
          expiryDate: resolvedExpiryDate,
          documentUrl: documentUrl || existing.documentUrl,
          expiryNoticeSentAt: null, // reset so a new expiry email can go out for the renewed date
          expiryNotice30SentAt: null,
        },
      })
    : await prisma.ticket.create({
        data: {
          consultantId: consultant.id,
          ticketTypeId,
          issueDate: new Date(issueDate),
          expiryDate: resolvedExpiryDate,
          documentUrl,
        },
      });

  // Let admins know a consultant just added/updated a ticket, so they can spot-check it
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });
    await sendTicketUploadedAlertEmail(
      admins.map((a) => a.email),
      `${consultant.firstName} ${consultant.lastName}`,
      consultant.id,
      ticketType.label,
      resolvedExpiryDate
    );
  } catch (err) {
    console.error('Failed to send ticket-uploaded alert email:', err);
    // Don't fail the ticket save just because the notification email failed
  }

  return NextResponse.json({ ticket }, { status: 201 });
}