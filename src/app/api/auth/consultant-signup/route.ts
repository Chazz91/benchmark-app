import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// GET ?token=... - lets the signup page check if a token is valid before showing the form
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ valid: false }, { status: 400 });

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    include: { consultant: true },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    firstName: invite.consultant.firstName,
    email: invite.consultant.email,
  });
}

// POST { token, password }
// Public endpoint - validates the invite token and creates the consultant's own login.
export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: 'Token and a password of at least 8 characters are required' },
      { status: 400 }
    );
  }

  const invite = await prisma.inviteToken.findUnique({
    where: { token },
    include: { consultant: true },
  });

  if (!invite) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
  if (invite.usedAt) return NextResponse.json({ error: 'This invite link has already been used' }, { status: 400 });
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 });
  }

  const consultant = invite.consultant;
  if (!consultant.email) {
    return NextResponse.json({ error: 'No email on file for this profile' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: consultant.email } });
  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: `${consultant.firstName} ${consultant.lastName}`,
      email: consultant.email,
      passwordHash,
      role: 'CONSULTANT',
    },
  });

  await prisma.consultant.update({
    where: { id: consultant.id },
    data: { userId: user.id },
  });

  await prisma.inviteToken.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

