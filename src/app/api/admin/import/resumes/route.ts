import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';

interface FileResult {
  fileName: string;
  status: 'created' | 'updated' | 'error';
  consultantName?: string;
  keywordsTagged?: number;
  message?: string;
}

// POST multipart/form-data with one or more "files" entries.
// For each resume: extracts text, sends it to Claude to pull out full name, email, phone,
// location, title, years of experience, and keywords - then creates a new consultant or
// updates an existing one (matched by email), uploads the resume, and tags the parsed
// keywords so they immediately show up in the toggleable search filters.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'At least one resume file is required' }, { status: 400 });
  }

  const results: FileResult[] = [];
  let created = 0;
  let updated = 0;

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const rawText = await extractTextFromFile(buffer, file.type);
      const parsed = await parseResumeText(rawText);

      if (!parsed.fullName && !parsed.email) {
        results.push({
          fileName: file.name,
          status: 'error',
          message: 'Could not identify a name or email in this resume — skipped',
        });
        continue;
      }

      // Split "Jane Smith" into firstName/lastName (best effort - last word is the last name)
      const nameParts = (parsed.fullName || file.name.replace(/\.(pdf|docx)$/i, '')).trim().split(/\s+/);
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Match an existing consultant by email if we have one, otherwise always create new
      let consultant = parsed.email
        ? await prisma.consultant.findFirst({ where: { email: parsed.email.toLowerCase() } })
        : null;

      const isNew = !consultant;

      if (!consultant) {
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
        created++;
      } else {
        // Only fill in fields that are currently blank - never overwrite existing curated data
        const updateData: Record<string, unknown> = {};
        if (!consultant.phone && parsed.phone) updateData.phone = parsed.phone;
        if (!consultant.location && parsed.location) updateData.location = parsed.location;
        if (!consultant.title && parsed.title) updateData.title = parsed.title;
        if (!consultant.yearsExperience && parsed.yearsExperience) updateData.yearsExperience = parsed.yearsExperience;
        if (!consultant.summary && parsed.summary) updateData.summary = parsed.summary;

        if (Object.keys(updateData).length > 0) {
          consultant = await prisma.consultant.update({ where: { id: consultant.id }, data: updateData });
        }
        updated++;
      }

      // Upload and link the resume file
      const key = `resumes/${consultant.id}/${Date.now()}-${file.name}`;
      const fileUrl = await uploadResumeFile(key, buffer, file.type);
      await prisma.resume.create({
        data: {
          consultantId: consultant.id,
          fileName: file.name,
          fileUrl,
          rawText,
          parsedAt: new Date(),
        },
      });

      // Resolve/tag every parsed keyword so it's immediately toggleable in search filters
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

      results.push({
        fileName: file.name,
        status: isNew ? 'created' : 'updated',
        consultantName: `${consultant.firstName} ${consultant.lastName}`,
        keywordsTagged: parsed.keywords.length,
      });
    } catch (err) {
      results.push({ fileName: file.name, status: 'error', message: (err as Error).message });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_IMPORTED_RESUMES',
      entityType: 'Consultant',
      entityId: 'bulk',
      metadata: { created, updated, total: files.length },
    },
  });

  return NextResponse.json({ created, updated, results });
}