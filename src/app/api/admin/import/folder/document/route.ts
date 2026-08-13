import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { parseTicketDocument } from '@/lib/ticketDocumentParser';
import { resolveTicketType } from '@/lib/resolveTicketType';
import { isExcludedFile } from '@/lib/fileExclusion';

// POST multipart/form-data: { file, consultantId }
// Processes exactly ONE certification/license document for an already-known consultant.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const consultantId = formData.get('consultantId') as string | null;

  if (!file || !consultantId) {
    return NextResponse.json({ error: 'file and consultantId are required' }, { status: 400 });
  }
  if (isExcludedFile(file.name)) {
    return NextResponse.json({ ticketsCreated: 0, notes: ['Skipped for safety (sensitive filename)'] });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: consultantId } });
  if (!consultant) return NextResponse.json({ error: 'Consultant not found' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await parseTicketDocument(buffer, file.type);

  if (detected.length === 0) {
    return NextResponse.json({ ticketsCreated: 0, notes: ["Couldn't detect a certification in this file"] });
  }

  let ticketsCreated = 0;
  const notes: string[] = [];

  for (const cert of detected) {
    const ticketType = cert.matchedTicketTypeId
      ? { id: cert.matchedTicketTypeId }
      : await resolveTicketType(file.name.replace(/\.(pdf|jpg|jpeg|png|gif|webp)$/i, ''));

    if (!ticketType) {
      notes.push(`"${cert.label}" — no matching ticket type`);
      continue;
    }

    const documentKey = `ticket-documents/${consultant.id}/${Date.now()}-${file.name}`;
    const documentUrl = await uploadResumeFile(documentKey, buffer, file.type);

    const existingTicket = await prisma.ticket.findFirst({
      where: { consultantId: consultant.id, ticketTypeId: ticketType.id },
    });

    if (existingTicket) {
      await prisma.ticket.update({
        where: { id: existingTicket.id },
        data: {
          issueDate: cert.issueDate ? new Date(cert.issueDate) : existingTicket.issueDate,
          expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : existingTicket.expiryDate,
          documentUrl,
          expiryNoticeSentAt: null,
          expiryNotice30SentAt: null,
        },
      });
    } else {
      await prisma.ticket.create({
        data: {
          consultantId: consultant.id,
          ticketTypeId: ticketType.id,
          issueDate: cert.issueDate ? new Date(cert.issueDate) : new Date(),
          expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
          documentUrl,
        },
      });
    }

    ticketsCreated++;
    if (cert.confidence < 0.6) {
      notes.push(`${cert.label} — low confidence, please double-check dates`);
    }
  }

  return NextResponse.json({ ticketsCreated, notes });
}