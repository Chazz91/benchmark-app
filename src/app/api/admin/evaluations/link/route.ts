import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST { consultantId } - returns an existing link's token, or creates a new one
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { consultantId } = await request.json();
  if (!consultantId) return NextResponse.json({ error: 'consultantId is required' }, { status: 400 });

  const existing = await prisma.evaluationLink.findUnique({ where: { consultantId } });
  if (existing) return NextResponse.json({ token: existing.token });

  const token = crypto.randomBytes(16).toString('hex');
  const link = await prisma.evaluationLink.create({
    data: { token, consultantId, createdById: session.user.id },
  });

  return NextResponse.json({ token: link.token });
}