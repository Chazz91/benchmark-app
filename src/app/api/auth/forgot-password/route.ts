import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

// POST { email } - always returns a generic success message, whether or not that email
// actually has an account, so this can't be used to check which emails are registered.
export async function POST(request: Request) {
  const { email } = await request.json();
  const genericResponse = NextResponse.json({
    message: 'If an account with that email exists, a reset link has been sent.',
  });

  if (!email) return genericResponse;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return genericResponse;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  await sendPasswordResetEmail(user.email, user.name, token);

  return genericResponse;
}