import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getResumeSignedUrl } from '@/lib/storage';

// GET - redirects to a short-lived signed URL for viewing this ticket's uploaded proof
// document/photo. Accessible to internal staff (admin/recruiter/viewer), or the consultant
// who owns the ticket - matching the same access pattern as resume viewing.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { consultant: true },
  });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!ticket.documentUrl) return NextResponse.json({ error: 'No document on file' }, { status: 404 });

  const isStaff = ['ADMIN', 'RECRUITER', 'VIEWER'].includes(session.user.role);
  const isOwner = session.user.role === 'CONSULTANT' && ticket.consultant.userId === session.user.id;

  if (!isStaff && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signedUrl = await getResumeSignedUrl(ticket.documentUrl);
  return NextResponse.redirect(signedUrl);
}

