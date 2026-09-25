import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile, getResumeSignedUrl } from '@/lib/storage';

// GET - redirects to a short-lived signed URL for viewing this consultant's service order
// sheet. Accessible to internal staff, or the consultant who owns it - same access pattern
// as resume/ticket document viewing.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!consultant.serviceOrderSheetUrl) {
    return NextResponse.json({ error: 'No service order sheet on file' }, { status: 404 });
  }

  const isStaff = ['ADMIN', 'RECRUITER', 'VIEWER'].includes(session.user.role);
  const isOwner = session.user.role === 'CONSULTANT' && consultant.userId === session.user.id;
  if (!isStaff && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const signedUrl = await getResumeSignedUrl(consultant.serviceOrderSheetUrl);
  return NextResponse.redirect(signedUrl);
}

// POST multipart/form-data: { file, startDate?, endDate? } - uploads a new service order
// sheet, replacing whichever one was on file before (only one is kept at a time).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const startDate = formData.get('startDate') as string | null;
  const endDate = formData.get('endDate') as string | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const key = `service-order-sheets/${consultant.id}/${Date.now()}-${file.name}`;
  const fileUrl = await uploadResumeFile(key, buffer, file.type);

  const updated = await prisma.consultant.update({
    where: { id: consultant.id },
    data: {
      serviceOrderSheetUrl: fileUrl,
      serviceOrderSheetFileName: file.name,
      serviceOrderSheetStartDate: startDate ? new Date(startDate) : null,
      serviceOrderSheetEndDate: endDate ? new Date(endDate) : null,
      serviceOrderSheetUploadedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'UPLOADED_SERVICE_ORDER_SHEET',
      entityType: 'Consultant',
      entityId: consultant.id,
    },
  });

  return NextResponse.json({ consultant: updated });
}

// DELETE - clears the service order sheet on file, without deleting the consultant record.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: params.id } });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.consultant.update({
    where: { id: consultant.id },
    data: {
      serviceOrderSheetUrl: null,
      serviceOrderSheetFileName: null,
      serviceOrderSheetStartDate: null,
      serviceOrderSheetEndDate: null,
      serviceOrderSheetUploadedAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
