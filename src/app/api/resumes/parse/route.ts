import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';

// POST multipart/form-data: { file, consultantId }
// 1. Uploads the resume file to S3
// 2. Extracts raw text (PDF/DOCX/plain)
// 3. Sends text to Claude for structured extraction (name, title, years, keywords)
// 4. Creates/links Keyword rows and tags the consultant with confidence scores
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const consultantId = formData.get('consultantId') as string | null;

  if (!file || !consultantId) {
    return NextResponse.json({ error: 'file and consultantId are required' }, { status: 400 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { id: consultantId } });
  if (!consultant) return NextResponse.json({ error: 'Consultant not found' }, { status: 404 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 1. Upload to storage
  const key = `resumes/${consultantId}/${Date.now()}-${file.name}`;
  const fileUrl = await uploadResumeFile(key, buffer, file.type);

  // 2. Extract raw text
  const rawText = await extractTextFromFile(buffer, file.type);

  // 3. Parse with Claude
  const parsed = await parseResumeText(rawText);

  // 4. Persist resume record
  const resume = await prisma.resume.create({
    data: {
      consultantId,
      fileName: file.name,
      fileUrl,
      rawText,
      parsedAt: new Date(),
    },
  });

  // 5. Resolve/link keywords with confidence, tagged as PARSED
  for (const kw of parsed.keywords) {
    const keyword = await resolveOrCreateKeyword(kw.label, kw.type);

    await prisma.consultantKeyword.upsert({
      where: { consultantId_keywordId: { consultantId, keywordId: keyword.id } },
      update: { source: 'PARSED', confidence: kw.confidence },
      create: {
        consultantId,
        keywordId: keyword.id,
        source: 'PARSED',
        confidence: kw.confidence,
      },
    });
  }

  // 6. Optionally fill in blank consultant fields from parsed data
  const updateData: Record<string, unknown> = {};
  if (!consultant.title && parsed.title) updateData.title = parsed.title;
  if (!consultant.yearsExperience && parsed.yearsExperience) updateData.yearsExperience = parsed.yearsExperience;
  if (!consultant.summary && parsed.summary) updateData.summary = parsed.summary;

  if (Object.keys(updateData).length > 0) {
    await prisma.consultant.update({ where: { id: consultantId }, data: updateData });
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'PARSED_RESUME',
      entityType: 'Consultant',
      entityId: consultantId,
      metadata: { resumeId: resume.id, keywordsFound: parsed.keywords.length },
    },
  });

  return NextResponse.json({ resume, parsed });
}

