import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';

// POST multipart/form-data with exactly one "file" entry. Same logic as the old bulk
// /resumes route, just scoped to a single file per request so a large batch can never
// time out - the frontend calls this once per resume, one at a time.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromFile(buffer, file.type);
    const parsed = await parseResumeText(rawText);

    if (!parsed.fullName && !parsed.email) {
      return NextResponse.json({
        fileName: file.name,
        status: 'error',
        message: 'Could not identify a name or email in this resume — skipped',
      });
    }

    const nameParts = (parsed.fullName || file.name.replace(/\.(pdf|docx)$/i, '')).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

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
    } else {
      const updateData: Record<string, unknown> = {};
      if (!consultant.phone && parsed.phone) updateData.phone = parsed.phone;
      if (!consultant.location && parsed.location) updateData.location = parsed.location;
      if (!consultant.title && parsed.title) updateData.title = parsed.title;
      if (!consultant.yearsExperience && parsed.yearsExperience) updateData.yearsExperience = parsed.yearsExperience;
      if (!consultant.summary && parsed.summary) updateData.summary = parsed.summary;
      if (Object.keys(updateData).length > 0) {
        consultant = await prisma.consultant.update({ where: { id: consultant.id }, data: updateData });
      }
    }

    const key = `resumes/${consultant.id}/${Date.now()}-${file.name}`;
    const fileUrl = await uploadResumeFile(key, buffer, file.type);
    await prisma.resume.create({
      data: { consultantId: consultant.id, fileName: file.name, fileUrl, rawText, parsedAt: new Date() },
    });

    for (const kw of parsed.keywords) {
      const keyword = await resolveOrCreateKeyword(kw.label, kw.type);
      await prisma.consultantKeyword.upsert({
        where: { consultantId_keywordId: { consultantId: consultant.id, keywordId: keyword.id } },
        update: { source: 'PARSED', confidence: kw.confidence },
        create: { consultantId: consultant.id, keywordId: keyword.id, source: 'PARSED', confidence: kw.confidence },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'BULK_IMPORTED_RESUMES',
        entityType: 'Consultant',
        entityId: consultant.id,
        metadata: { fileName: file.name },
      },
    });

    return NextResponse.json({
      fileName: file.name,
      status: isNew ? 'created' : 'updated',
      consultantName: `${consultant.firstName} ${consultant.lastName}`,
      keywordsTagged: parsed.keywords.length,
    });
  } catch (err) {
    return NextResponse.json({ fileName: file.name, status: 'error', message: (err as Error).message });
  }
}

