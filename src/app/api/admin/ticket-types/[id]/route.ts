import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH { label?, discipline?, validMonths?, hasExpiry? } - edits a ticket type in place by
// id, rather than the original POST's upsert-by-label (which can't rename one, since label is
// what it keys on).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.ticketType.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { label, discipline, validMonths, hasExpiry } = await request.json();

  const data: Record<string, unknown> = {};
  if (label !== undefined) {
    if (!label.trim()) return NextResponse.json({ error: 'Label cannot be empty' }, { status: 400 });
    data.label = label.trim();
  }
  if (discipline !== undefined) data.discipline = discipline;
  if (validMonths !== undefined) data.validMonths = validMonths;
  if (hasExpiry !== undefined) data.hasExpiry = hasExpiry;

  try {
    const ticketType = await prisma.ticketType.update({ where: { id: params.id }, data });
    return NextResponse.json({ ticketType });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Another ticket type already has that label' }, { status: 400 });
    }
    throw err;
  }
}

// DELETE - refuses if any consultant actually has this ticket on file, since deleting it would
// silently wipe their certification history. Client-specific requirement rows referencing it
// are cascade-deleted automatically (see ClientTicketRequirement in the schema).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.ticketType.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const inUseCount = await prisma.ticket.count({ where: { ticketTypeId: params.id } });
  if (inUseCount > 0) {
    return NextResponse.json(
      {
        error: `Can't delete "${existing.label}" — ${inUseCount} consultant(s) have it on file. Remove it from their profiles first, or rename it instead of deleting.`,
      },
      { status: 400 }
    );
  }

  await prisma.ticketType.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
