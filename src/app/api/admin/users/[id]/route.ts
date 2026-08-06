import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH { isActive: boolean } - toggles whether a user can log in
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Don't allow an admin to lock themselves out mid-session
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
  }

  const { isActive } = await request.json();
  if (typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive must be true or false' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { isActive },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ user });
}

