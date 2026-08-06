import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST { ticketTypeId, required: boolean, discipline?: 'DRILLING'|'COMPLETIONS'|'LEASE_CONSTRUCTION'|'ALL' } -
// sets/clears whether a ticket type is required for this client, and for which discipline(s)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ticketTypeId, required, discipline } = await request.json();
  if (!ticketTypeId) return NextResponse.json({ error: 'ticketTypeId is required' }, { status: 400 });

  if (required) {
    await prisma.clientTicketRequirement.upsert({
      where: { clientId_ticketTypeId: { clientId: params.id, ticketTypeId } },
      update: { discipline: discipline || 'ALL' },
      create: { clientId: params.id, ticketTypeId, discipline: discipline || 'ALL' },
    });
  } else {
    await prisma.clientTicketRequirement.deleteMany({
      where: { clientId: params.id, ticketTypeId },
    });
  }

  return NextResponse.json({ success: true });
}

