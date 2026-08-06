import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Papa from 'papaparse';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Expected CSV columns:
// ConsultantEmail,TicketType,IssueDate,ExpiryDate
//
// IssueDate format: YYYY-MM-DD
// ExpiryDate is optional — if left blank, it's auto-calculated as IssueDate + the ticket
// type's default validity period (set in Admin > Ticket Types).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    try {
      if (!row.ConsultantEmail || !row.TicketType || !row.IssueDate) {
        errors.push({ row: i + 2, message: 'ConsultantEmail, TicketType, and IssueDate are required' });
        continue;
      }

      const consultant = await prisma.consultant.findFirst({
        where: { email: row.ConsultantEmail.trim() },
      });
      if (!consultant) {
        errors.push({ row: i + 2, message: `No consultant found with email ${row.ConsultantEmail}` });
        continue;
      }

      const ticketType = await prisma.ticketType.findFirst({
        where: { label: { equals: row.TicketType.trim(), mode: 'insensitive' } },
      });
      if (!ticketType) {
        errors.push({
          row: i + 2,
          message: `No ticket type found named "${row.TicketType}" — add it in Admin > Ticket Types first`,
        });
        continue;
      }

      const issueDate = new Date(row.IssueDate);
      if (isNaN(issueDate.getTime())) {
        errors.push({ row: i + 2, message: `Invalid IssueDate: ${row.IssueDate}` });
        continue;
      }

      let expiryDate: Date | null = null;
      const expiryCell = (row.ExpiryDate || '').trim();
      const explicitlyNoExpiry = ['N/A', 'NA', 'NONE'].includes(expiryCell.toUpperCase());

      if (explicitlyNoExpiry) {
        expiryDate = null; // this specific consultant's ticket has no expiry, regardless of the type's usual default
      } else if (expiryCell) {
        expiryDate = new Date(expiryCell);
        if (isNaN(expiryDate.getTime())) {
          errors.push({ row: i + 2, message: `Invalid ExpiryDate: ${row.ExpiryDate}` });
          continue;
        }
      } else if (ticketType.hasExpiry) {
        // blank cell + type normally expires - auto-fill from the type's default validity period
        expiryDate = new Date(issueDate);
        expiryDate.setMonth(expiryDate.getMonth() + ticketType.validMonths);
      }
      // else: blank cell + type normally doesn't expire -> stays null (N/A)

      const existing = await prisma.ticket.findFirst({
        where: { consultantId: consultant.id, ticketTypeId: ticketType.id },
      });

      if (existing) {
        await prisma.ticket.update({
          where: { id: existing.id },
          data: { issueDate, expiryDate, expiryNoticeSentAt: null, expiryNotice30SentAt: null },
        });
        updated++;
      } else {
        await prisma.ticket.create({
          data: { consultantId: consultant.id, ticketTypeId: ticketType.id, issueDate, expiryDate },
        });
        created++;
      }
    } catch (err) {
      errors.push({ row: i + 2, message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_IMPORTED_TICKETS',
      entityType: 'Ticket',
      entityId: 'bulk',
      metadata: { created, updated, errorCount: errors.length },
    },
  });

  return NextResponse.json({ created, updated, errors });
}

