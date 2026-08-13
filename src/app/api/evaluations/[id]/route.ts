import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER', 'VIEWER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id: params.id },
    include: {
      consultant: { select: { id: true, firstName: true, lastName: true, title: true } },
    },
  });
  if (!evaluation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ evaluation });
}