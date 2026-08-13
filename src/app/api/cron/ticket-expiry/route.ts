import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTicketExpiryEmail } from '@/lib/email';

// GET /api/cron/ticket-expiry
// Protected by a shared secret (set CRON_SECRET in env, and Vercel Cron sends it as a header).
// Sends TWO separate reminder emails per ticket as it approaches expiry:
//   - a first heads-up once it's within 60 days (tracked via expiryNoticeSentAt)
//   - a closer, more urgent follow-up once it's within 30 days (tracked via expiryNotice30SentAt)
// Both are tracked separately so a ticket gets exactly one email per window, not duplicates.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const sixtyDaysFromNow = new Date(now + 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now + 30 * 24 * 60 * 60 * 1000);

  let sent60 = 0;
  let sent30 = 0;

  // First window: within 60 days, no 60-day notice sent yet
  const sixtyDayTickets = await prisma.ticket.findMany({
    where: { expiryDate: { lte: sixtyDaysFromNow }, expiryNoticeSentAt: null },
    include: { consultant: true, ticketType: true },
  });

  for (const ticket of sixtyDayTickets) {
    if (!ticket.consultant.email) continue;
    try {
      await sendTicketExpiryEmail(
        ticket.consultant.email,
        ticket.consultant.firstName,
        ticket.ticketType.label,
        ticket.expiryDate,
        60
      );
      await prisma.ticket.update({ where: { id: ticket.id }, data: { expiryNoticeSentAt: new Date() } });
      sent60++;
    } catch (err) {
      console.error(`Failed to send 60-day expiry email for ticket ${ticket.id}:`, err);
    }
  }

  // Second window: within 30 days, no 30-day notice sent yet (separate from the 60-day tracking)
  const thirtyDayTickets = await prisma.ticket.findMany({
    where: { expiryDate: { lte: thirtyDaysFromNow }, expiryNotice30SentAt: null },
    include: { consultant: true, ticketType: true },
  });

  for (const ticket of thirtyDayTickets) {
    if (!ticket.consultant.email) continue;
    try {
      await sendTicketExpiryEmail(
        ticket.consultant.email,
        ticket.consultant.firstName,
        ticket.ticketType.label,
        ticket.expiryDate,
        30
      );
      await prisma.ticket.update({ where: { id: ticket.id }, data: { expiryNotice30SentAt: new Date() } });
      sent30++;
    } catch (err) {
      console.error(`Failed to send 30-day expiry email for ticket ${ticket.id}:`, err);
    }
  }

  const result = { checked60Day: sixtyDayTickets.length, emailsSent60Day: sent60, checked30Day: thirtyDayTickets.length, emailsSent30Day: sent30 };

  await prisma.systemStatus.upsert({
    where: { id: 'singleton' },
    update: { lastCronRunAt: new Date(), lastCronResult: JSON.stringify(result) },
    create: { id: 'singleton', lastCronRunAt: new Date(), lastCronResult: JSON.stringify(result) },
  });

  return NextResponse.json(result);
}