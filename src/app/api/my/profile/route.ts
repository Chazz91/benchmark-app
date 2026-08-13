import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [consultant, clients] = await Promise.all([
    prisma.consultant.findUnique({
      where: { userId: session.user.id },
      include: {
        currentClient: true,
        resumes: { orderBy: { createdAt: 'desc' } },
        evaluations: {
          // Consultants only ever see their scores, never the written comments/feedback -
          // that's restricted to internal staff. Selecting only these fields means the
          // comment text never even reaches the consultant's browser.
          select: {
            id: true,
            overallScore: true,
            safetyScore: true,
            knowledgeScore: true,
            reportingScore: true,
            professionalismScore: true,
            wouldRecommend: true,
            evaluatorCompany: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.clientCompany.findMany({ orderBy: { name: 'asc' } }),
  ]);

  if (!consultant) return NextResponse.json({ error: 'No consultant profile found' }, { status: 404 });

  return NextResponse.json({ consultant, clients });
}

// POST - updates any subset of the consultant's own editable profile fields
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    workingStatus,
    currentClientId,
    phone,
    email,
    location,
    bio,
    emergencyContactName,
    emergencyContactPhone,
  } = body;

  const consultant = await prisma.consultant.findUnique({ where: { userId: session.user.id } });
  if (!consultant) return NextResponse.json({ error: 'No consultant profile found' }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (workingStatus !== undefined) {
    if (!['AVAILABLE', 'WORKING'].includes(workingStatus)) {
      return NextResponse.json({ error: 'Invalid workingStatus' }, { status: 400 });
    }
    data.workingStatus = workingStatus;
    // clear the client if going back to Available; otherwise use whatever was selected
    data.currentClientId = workingStatus === 'AVAILABLE' ? null : currentClientId || null;
  }

  if (phone !== undefined) data.phone = phone || null;
  if (email !== undefined) data.email = email || null;
  if (location !== undefined) data.location = location || null;
  if (bio !== undefined) data.bio = bio || null;
  if (emergencyContactName !== undefined) data.emergencyContactName = emergencyContactName || null;
  if (emergencyContactPhone !== undefined) data.emergencyContactPhone = emergencyContactPhone || null;

  const updated = await prisma.consultant.update({
    where: { id: consultant.id },
    data,
  });

  return NextResponse.json({ consultant: updated });
}