import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { parseTicketDocument } from '@/lib/ticketDocumentParser';
import { resolveTicketType } from '@/lib/resolveTicketType';

interface FileResult {
  fileName: string;
  type: 'ticket' | 'skipped' | 'error';
  message: string;
}

// POST multipart/form-data: { files: File[] } - a dedicated ticket upload for one consultant,
// separate from the general bulk-upload box. Every file here is always treated as a
// certification document (never guessed at as a resume), so a ticket photo/PDF can't
// accidentally get filed as this consultant's resume the way it could when dropped into the
// catch-all uploader below.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  if (files.length === 0) return NextResponse.json({ error: 'No files received' }, { status: 400 });

  const results: FileResult[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const detected = await parseTicketDocument(buffer, file.type);

      if (detected.length === 0) {
        results.push({ fileName: file.name, type: 'skipped', message: "Couldn't detect a certification in this file" });
        continue;
      }

      for (const cert of detected) {
        const ticketType = cert.matchedTicketTypeId
          ? { id: cert.matchedTicketTypeId }
          : await resolveTicketType(cert.label);

        if (!ticketType) {
          results.push({ fileName: file.name, type: 'skipped', message: `"${cert.label}" — no matching ticket type` });
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

        results.push({
          fileName: file.name,
          type: 'ticket',
          message: `${cert.label} — ${cert.confidence < 0.6 ? 'low confidence, please double-check dates' : 'saved'}`,
        });
      }
    } catch (err) {
      results.push({ fileName: file.name, type: 'error', message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'UPLOADED_TICKET_DOCUMENT',
      entityType: 'Consultant',
      entityId: consultant.id,
      metadata: { fileCount: files.length },
    },
  });

  return NextResponse.json({ results });
}
