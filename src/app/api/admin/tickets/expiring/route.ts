import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/tickets/expiring?days=60 - tickets expiring within N days (default 60),
// including anything already expired, soonest first - so staff can see exactly who needs
// a push, on top of the automated reminder emails already sent to the consultant directly.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get('days')) || 60;
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const tickets = await prisma.ticket.findMany({
    where: { expiryDate: { lte: cutoff } },
    include: {
      ticketType: true,
      consultant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          currentClient: { select: { name: true } },
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
  });

  return NextResponse.json({ tickets });
}
