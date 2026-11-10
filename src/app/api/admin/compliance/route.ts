import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// How stale a resume has to be (no update in this many days) before it's flagged - same
// rough window as "within 60 days" for tickets would be too aggressive for a document that
// doesn't actually expire, so this is a much longer, one-sided check.
const STALE_RESUME_DAYS = 365;
const EXPIRING_SOON_DAYS = 60;

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

// GET - a roster-wide compliance snapshot for admins: who's missing a required ticket, who has
// one expiring soon (or already expired), and whose resume hasn't been touched in a while.
// Read-only, computed fresh on every load rather than cached, since the underlying data (new
// tickets, renewed ones, new resumes) changes constantly and this needs to reflect "right now".
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const [consultants, allTicketTypes] = await Promise.all([
    prisma.consultant.findMany({
      where: includeInactive ? {} : { status: { not: 'INACTIVE' } },
      include: {
        tickets: { include: { ticketType: true } },
        resumes: { where: { isFormatted: false }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.ticketType.findMany(),
  ]);

  const now = new Date();

  const items = consultants.map((c) => {
    const heldTicketTypeIds = new Set(c.tickets.map((t) => t.ticketTypeId));

    // Office-based consultants have no "required" ticket list at all (see My Tickets /
    // send-profile-reminder) - consistent with that, they're never flagged for missing ones.
    const missingTickets = c.officeBased
      ? []
      : allTicketTypes
          .filter((rt) => rt.discipline === c.discipline || rt.discipline === 'ALL')
          .filter((rt) => !heldTicketTypeIds.has(rt.id))
          .map((rt) => rt.label);

    const expiringTickets = c.tickets
      .filter((t) => t.expiryDate)
      .map((t) => ({
        label: t.ticketType.label,
        expiryDate: t.expiryDate as Date,
        daysUntil: daysBetween(now, t.expiryDate as Date),
      }))
      .filter((t) => t.daysUntil <= EXPIRING_SOON_DAYS)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const latestResume = c.resumes[0] || null;
    const resumeAgeDays = latestResume ? daysBetween(latestResume.createdAt, now) : null;
    const resumeStatus: 'none' | 'stale' | 'current' = !latestResume
      ? 'none'
      : resumeAgeDays! > STALE_RESUME_DAYS
        ? 'stale'
        : 'current';

    const hasIssue = missingTickets.length > 0 || expiringTickets.length > 0 || resumeStatus !== 'current';

    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      discipline: c.discipline,
      status: c.status,
      officeBased: c.officeBased,
      missingTickets,
      expiringTickets,
      resumeStatus,
      resumeLastUpdated: latestResume?.createdAt || null,
      hasIssue,
    };
  });

  return NextResponse.json({
    items,
    summary: {
      totalChecked: items.length,
      withIssues: items.filter((i) => i.hasIssue).length,
    },
  });
}
