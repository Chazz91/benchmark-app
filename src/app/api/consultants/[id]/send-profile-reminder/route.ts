import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendCompleteProfileEmail } from '@/lib/email';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: params.id },
    include: { resumes: true, tickets: { include: { ticketType: true } } },
  });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!consultant.userId) {
    return NextResponse.json(
      { error: "This consultant hasn't set up their own login yet - send them an invite link first" },
      { status: 400 }
    );
  }
  if (!consultant.email) {
    return NextResponse.json({ error: 'No email on file to send this to' }, { status: 400 });
  }

  const missingItems: string[] = [];
  if (!consultant.phone) missingItems.push('Phone number');
  if (consultant.resumes.length === 0) missingItems.push('Resume');

  // Compare against the same required-tickets list shown on their own My Tickets page -
  // this correctly covers driver's license too, since it's just one of the required types,
  // rather than needing a separate special-case check for it.
  const requiredTypes = await prisma.ticketType.findMany({
    where: { OR: [{ discipline: consultant.discipline }, { discipline: 'ALL' }] },
  });
  const heldTicketTypeIds = new Set(consultant.tickets.map((t) => t.ticketTypeId));
  const missingTicketLabels = requiredTypes
    .filter((rt) => !heldTicketTypeIds.has(rt.id))
    .map((rt) => rt.label);

  missingItems.push(...missingTicketLabels);

  if (missingItems.length === 0) {
    return NextResponse.json({ error: 'Nothing appears to be missing from their profile' }, { status: 400 });
  }

  await sendCompleteProfileEmail(consultant.email, consultant.firstName, missingItems);

  return NextResponse.json({ success: true, missingItems });
}

