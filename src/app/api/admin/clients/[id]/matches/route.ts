import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const EXPIRING_SOON_DAYS = 60;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// GET - for this client, checks every active (non-inactive) consultant against the client's
// discipline-scoped ticket requirements and reports who's missing what. This is the piece that
// was never built when client requirements were first added - the requirements themselves could
// be set, but nothing actually checked a consultant's tickets against them.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER', 'VIEWER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await prisma.clientCompany.findUnique({
    where: { id: params.id },
    include: { requiredTicketTypes: { include: { ticketType: true } } },
  });
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const consultants = await prisma.consultant.findMany({
    where: { status: { not: 'INACTIVE' } },
    include: { tickets: { include: { ticketType: true } } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const results = consultants.map((consultant) => {
    // Which of this client's requirements actually apply to this consultant: a requirement
    // scoped to "ALL" applies to everyone, and a consultant whose own discipline is "ALL"
    // (works across everything) is on the hook for every discipline-specific requirement too.
    const applicableRequirements = client.requiredTicketTypes.filter(
      (req) =>
        req.discipline === 'ALL' || consultant.discipline === 'ALL' || req.discipline === consultant.discipline
    );

    const missing: string[] = [];
    const expiringSoon: { label: string; days: number }[] = [];

    for (const req of applicableRequirements) {
      const ticket = consultant.tickets.find((t) => t.ticketTypeId === req.ticketTypeId);
      if (!ticket) {
        missing.push(req.ticketType.label);
        continue;
      }
      if (ticket.expiryDate) {
        const days = daysUntil(ticket.expiryDate);
        if (days < 0) {
          missing.push(`${req.ticketType.label} (expired)`);
        } else if (days <= EXPIRING_SOON_DAYS) {
          expiringSoon.push({ label: req.ticketType.label, days });
        }
      }
    }

    return {
      consultantId: consultant.id,
      name: `${consultant.firstName} ${consultant.lastName}`,
      discipline: consultant.discipline,
      status: consultant.status,
      isCurrentlyHere: consultant.currentClientId === client.id,
      requiredCount: applicableRequirements.length,
      missing,
      expiringSoon,
    };
  });

  // Nobody has any requirements that apply to them (e.g. no requirements set up yet) - the
  // frontend can distinguish "no requirements configured" from "everyone's compliant".
  const anyRequirements = client.requiredTicketTypes.length > 0;

  results.sort((a, b) => {
    if (a.isCurrentlyHere !== b.isCurrentlyHere) return a.isCurrentlyHere ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    anyRequirements,
    results,
  });
}
