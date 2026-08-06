import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';

// POST multipart/form-data: { file }
// Consultant-only self-service resume upload. Same pipeline as the admin/import version:
// extracts text, sends it to Claude, and auto-tags any formations/rig types/skills/certs/
// software it finds - so a consultant keeping their own resume current also keeps their
// search-visibility current, without needing a recruiter to do it for them.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { userId: session.user.id } });
  if (!consultant) return NextResponse.json({ error: 'No consultant profile found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const key = `resumes/${consultant.id}/${Date.now()}-${file.name}`;
  const fileUrl = await uploadResumeFile(key, buffer, file.type);
  const rawText = await extractTextFromFile(buffer, file.type);

  const resume = await prisma.resume.create({
    data: {
      consultantId: consultant.id,
      fileName: file.name,
      fileUrl,
      rawText,
      parsedAt: new Date(),
    },
  });

  try {
    const parsed = await parseResumeText(rawText);

    for (const kw of parsed.keywords) {
      const keyword = await resolveOrCreateKeyword(kw.label, kw.type);
      await prisma.consultantKeyword.upsert({
        where: { consultantId_keywordId: { consultantId: consultant.id, keywordId: keyword.id } },
        update: { source: 'PARSED', confidence: kw.confidence },
        create: {
          consultantId: consultant.id,
          keywordId: keyword.id,
          source: 'PARSED',
          confidence: kw.confidence,
        },
      });
    }

    // Fill in any fields that are currently blank - never overwrite what they've already set
    const updateData: Record<string, unknown> = {};
    if (!consultant.title && parsed.title) updateData.title = parsed.title;
    if (!consultant.location && parsed.location) updateData.location = parsed.location;
    if (!consultant.summary && parsed.summary) updateData.summary = parsed.summary;
    if (Object.keys(updateData).length > 0) {
      await prisma.consultant.update({ where: { id: consultant.id }, data: updateData });
    }

    return NextResponse.json({ resume, keywordsTagged: parsed.keywords.length });
  } catch (err) {
    // Resume is still saved even if AI parsing fails - just no auto-tagged keywords this time
    console.error('Resume parsing failed on self-service upload:', err);
    return NextResponse.json({ resume, keywordsTagged: 0 });
  }
}

