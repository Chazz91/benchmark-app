import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH { isActive?: boolean, newPassword?: string } - toggles login access and/or directly
// sets a new password for a user. Works regardless of email delivery status, since the admin
// communicates the new password to the person directly (same as account creation already does).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (typeof body.isActive === 'boolean') {
    // Don't allow an admin to lock themselves out mid-session
    if (params.id === session.user.id && body.isActive === false) {
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    }
    updateData.isActive = body.isActive;
  }

  if (typeof body.newPassword === 'string') {
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    updateData.passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ user });
}


