import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resume = await prisma.resume.findUnique({ where: { id: params.id } });
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.resume.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}

