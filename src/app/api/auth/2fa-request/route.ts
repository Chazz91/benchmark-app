import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendTwoFactorCodeEmail } from '@/lib/email';

// POST { email, password } - validates credentials WITHOUT creating a session, then emails a
// 6-digit code. The actual sign-in only completes once that code is submitted back (see
// authorize() in auth.ts, which requires a valid matching code alongside the password).
export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Same generic response whether or not the account exists/password matches - this is a
  // login flow, so being deliberately vague here avoids confirming which emails have accounts.
  const genericResponse = NextResponse.json({
    message: 'If those credentials are correct, a verification code has been sent to your email.',
  });

  if (!user || !user.isActive) return genericResponse;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return genericResponse;

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.twoFactorCode.create({
    data: { userId: user.id, code, expiresAt },
  });

  await sendTwoFactorCodeEmail(user.email, user.name, code);

  return genericResponse;
}