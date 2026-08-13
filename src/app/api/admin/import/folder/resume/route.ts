import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';
import { isExcludedFile } from '@/lib/fileExclusion';

// POST multipart/form-data: { file, folderName, consultantId? }
// Processes exactly ONE resume file - kept small and fast (one Claude call) so it never
// risks timing out, even when a folder has many files overall. If consultantId is passed,
// this resume is treated as an additional one for an already-identified consultant (from
// an earlier resume in the same folder) rather than creating/matching a new one.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const folderName = (formData.get('folderName') as string) || 'Unknown';
  const existingConsultantId = formData.get('consultantId') as string | null;

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (isExcludedFile(file.name)) {
    return NextResponse.json({ error: 'Skipped for safety (sensitive filename)' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawText = await extractTextFromFile(buffer, file.type);
  const parsed = await parseResumeText(rawText);

  let consultant;
  let isNew = false;

  if (existingConsultantId) {
    consultant = await prisma.consultant.findUnique({ where: { id: existingConsultantId } });
  } else {
    consultant = parsed.email
      ? await prisma.consultant.findFirst({ where: { email: parsed.email.toLowerCase() } })
      : null;
    isNew = !consultant;

    if (!consultant) {
      const nameParts = (parsed.fullName || folderName).trim().split(/\s+/);
      const firstName = nameParts[0] || folderName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      consultant = await prisma.consultant.create({
        data: {
          firstName,
          lastName,
          email: parsed.email?.toLowerCase(),
          phone: parsed.phone || undefined,
          location: parsed.location || undefined,
          title: parsed.title || undefined,
          yearsExperience: parsed.yearsExperience || undefined,
          summary: parsed.summary || undefined,
          status: 'ACTIVE',
          createdById: session.user.id,
        },
      });
    }
  }

  if (!consultant) {
    return NextResponse.json({ error: 'Could not find or create a consultant for this resume' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (!consultant.phone && parsed.phone) updateData.phone = parsed.phone;
  if (!consultant.location && parsed.location) updateData.location = parsed.location;
  if (!consultant.title && parsed.title) updateData.title = parsed.title;
  if (!consultant.yearsExperience && parsed.yearsExperience) updateData.yearsExperience = parsed.yearsExperience;
  if (!consultant.summary && parsed.summary) updateData.summary = parsed.summary;
  if (Object.keys(updateData).length > 0) {
    consultant = await prisma.consultant.update({ where: { id: consultant.id }, data: updateData });
  }

  const resumeKey = `resumes/${consultant.id}/${Date.now()}-${file.name}`;
  const resumeUrl = await uploadResumeFile(resumeKey, buffer, file.type);
  await prisma.resume.create({
    data: { consultantId: consultant.id, fileName: file.name, fileUrl: resumeUrl, rawText, parsedAt: new Date() },
  });

  for (const kw of parsed.keywords) {
    const keyword = await resolveOrCreateKeyword(kw.label, kw.type);
    await prisma.consultantKeyword.upsert({
      where: { consultantId_keywordId: { consultantId: consultant.id, keywordId: keyword.id } },
      update: { source: 'PARSED', confidence: kw.confidence },
      create: { consultantId: consultant.id, keywordId: keyword.id, source: 'PARSED', confidence: kw.confidence },
    });
  }

  return NextResponse.json({
    consultantId: consultant.id,
    consultantName: `${consultant.firstName} ${consultant.lastName}`,
    isNew,
    keywordsTagged: parsed.keywords.length,
  });
}