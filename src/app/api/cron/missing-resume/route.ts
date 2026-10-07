import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCompleteProfileEmail } from '@/lib/email';

// While rolling this feature out, MISSING_RESUME_ALLOWLIST restricts these emails to specific
// consultants being tested with, instead of going out to every real consultant missing a
// resume. Set it to a comma-separated list of consultant emails to test with a few people, or
// to "*" once it's confirmed and ready for everyone. Leaving it unset sends to no one - the
// safe default until testing is done. Same pattern as TICKET_EXPIRY_ALLOWLIST.
function isAllowedRecipient(email: string): boolean {
  const raw = process.env.MISSING_RESUME_ALLOWLIST;
  if (!raw) return false;
  if (raw.trim() === '*') return true;
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

// GET /api/cron/missing-resume
// Protected by a shared secret (set CRON_SECRET in env, and Vercel Cron sends it as a header).
// Reminds every consultant with no resume on file (and an account to act on it) to upload
// one - deliberately run weekly (see vercel.json) rather than daily, and with no per-
// consultant "already sent" tracking: the schedule itself is the throttle, since anyone who
// uploads a resume stops matching this query entirely and anyone who hasn't just gets
// reminded again next week.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [consultants, allTicketTypes] = await Promise.all([
    prisma.consultant.findMany({
      where: {
        status: { not: 'INACTIVE' },
        userId: { not: null },
        email: { not: null },
        resumes: { none: {} },
      },
      include: { tickets: true },
    }),
    prisma.ticketType.findMany(),
  ]);

  let sent = 0;
  let skipped = 0;

  for (const consultant of consultants) {
    if (!consultant.email) continue;
    if (!isAllowedRecipient(consultant.email)) {
      skipped++;
      continue;
    }

    // Same missing-items logic as the manual "Send Profile Reminder" admin action - resume is
    // always in the list here (that's the query condition), plus whatever else is missing, so
    // the email is a useful nudge rather than a one-line "upload a resume" message.
    const missingItems: string[] = ['Resume'];
    if (!consultant.phone) missingItems.push('Phone number');

    const requiredTypes = allTicketTypes.filter(
      (rt) => rt.discipline === consultant.discipline || rt.discipline === 'ALL'
    );
    const heldTicketTypeIds = new Set(consultant.tickets.map((t) => t.ticketTypeId));
    missingItems.push(...requiredTypes.filter((rt) => !heldTicketTypeIds.has(rt.id)).map((rt) => rt.label));

    try {
      await sendCompleteProfileEmail(consultant.email, consultant.firstName, missingItems);
      sent++;
    } catch (err) {
      console.error(`Failed to send missing-resume email to consultant ${consultant.id}:`, err);
    }
  }

  const result = { checked: consultants.length, emailsSent: sent, skippedNotAllowlisted: skipped };

  await prisma.systemStatus.upsert({
    where: { id: 'missing-resume-cron' },
    update: { lastCronRunAt: new Date(), lastCronResult: JSON.stringify(result) },
    create: { id: 'missing-resume-cron', lastCronRunAt: new Date(), lastCronResult: JSON.stringify(result) },
  });

  return NextResponse.json(result);
}
