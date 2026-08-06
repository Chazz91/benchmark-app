import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';

// POST multipart/form-data: { firstName, lastName, email, phone, discipline, yearsExperience, file }
// Public endpoint - no login required. Creates a PENDING Application for admin review.
export async function POST(request: Request) {
  const formData = await request.formData();
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string | null;
  const discipline = formData.get('discipline') as string;
  const yearsExperience = formData.get('yearsExperience') as string | null;
  const file = formData.get('file') as File | null;
  const formationIdsRaw = formData.get('formationIds') as string | null;
  const otherFormationNotes = formData.get('otherFormationNotes') as string | null;
  const formationIds = formationIdsRaw ? formationIdsRaw.split(',').filter(Boolean) : [];
  const hasCanadianPassport = formData.get('hasCanadianPassport') === 'true';
  const hasUSPassport = formData.get('hasUSPassport') === 'true';

  if (!firstName || !lastName || !email || !discipline) {
    return NextResponse.json(
      { error: 'firstName, lastName, email, and discipline are required' },
      { status: 400 }
    );
  }

  if (!hasCanadianPassport) {
    return NextResponse.json(
      { error: 'A valid Canadian passport is required to submit an application at this time.' },
      { status: 400 }
    );
  }

  if (!['DRILLING', 'COMPLETIONS', 'LEASE_CONSTRUCTION', 'ALL'].includes(discipline)) {
    return NextResponse.json({ error: 'Invalid discipline' }, { status: 400 });
  }

  let resumeUrl: string | undefined;
  let resumeFileName: string | undefined;
  let rawText: string | undefined;
  let parsedKeywords: { label: string; type: string; confidence: number }[] = [];
  let parsedSummary: string | undefined;
  let parsedTitle: string | undefined;

  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `applications/${Date.now()}-${file.name}`;

    try {
      resumeUrl = await uploadResumeFile(key, buffer, file.type);
      rawText = await extractTextFromFile(buffer, file.type);
      resumeFileName = file.name;

      const parsed = await parseResumeText(rawText);
      parsedKeywords = parsed.keywords;
      parsedSummary = parsed.summary;
      parsedTitle = parsed.title;
    } catch (err) {
      // Don't block the application if parsing fails - just log and continue without it
      console.error('Resume parsing failed for application:', err);
    }
  }

  const application = await prisma.application.create({
    data: {
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone: phone || undefined,
      discipline: discipline as 'DRILLING' | 'COMPLETIONS' | 'LEASE_CONSTRUCTION' | 'ALL',
      hasCanadianPassport,
      hasUSPassport,
      yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
      title: parsedTitle,
      resumeFileName,
      resumeUrl,
      rawText,
      parsedSummary,
      otherFormationNotes: otherFormationNotes || undefined,
    },
  });

  // Save the formations the applicant manually selected (in addition to anything AI-parsed from the resume)
  for (const keywordId of formationIds) {
    await prisma.applicationKeyword.upsert({
      where: { applicationId_keywordId: { applicationId: application.id, keywordId } },
      update: {},
      create: { applicationId: application.id, keywordId },
    });
  }

  for (const kw of parsedKeywords) {
    const keyword = await resolveOrCreateKeyword(kw.label, kw.type as any);

    await prisma.applicationKeyword.upsert({
      where: { applicationId_keywordId: { applicationId: application.id, keywordId: keyword.id } },
      update: { confidence: kw.confidence },
      create: { applicationId: application.id, keywordId: keyword.id, confidence: kw.confidence },
    });
  }

  return NextResponse.json({ success: true, applicationId: application.id }, { status: 201 });
}

