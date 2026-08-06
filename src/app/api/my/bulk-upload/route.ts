import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';
import { parseTicketDocument } from '@/lib/ticketDocumentParser';
import { resolveTicketType } from '@/lib/resolveTicketType';
import { isExcludedFile } from '@/lib/fileExclusion';

const RESUME_NAME_HINTS = ['resume', 'cv'];
const IMAGE_OR_PDF = /\.(pdf|jpg|jpeg|png|gif|webp)$/i;

interface FileResult {
  fileName: string;
  type: 'resume' | 'ticket' | 'skipped' | 'error';
  message: string;
}

// POST multipart/form-data: { files: File[] } - for the currently logged-in consultant's own
// profile. Same auto-detection as the admin bulk upload: resume-like files fill in anything
// blank + tag keywords, everything else gets read as a possible certification.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'CONSULTANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({ where: { userId: session.user.id } });
  if (!consultant) return NextResponse.json({ error: 'No consultant profile found' }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  if (files.length === 0) return NextResponse.json({ error: 'No files received' }, { status: 400 });

  const results: FileResult[] = [];

  const resumeFiles = files.filter(
    (f) => !isExcludedFile(f.name) && RESUME_NAME_HINTS.some((hint) => f.name.toLowerCase().includes(hint))
  );
  const fallbackResume =
    resumeFiles.length === 0 ? files.filter((f) => !isExcludedFile(f.name) && /\.(pdf|docx)$/i.test(f.name)).slice(0, 1) : [];
  const allResumeFiles = [...resumeFiles, ...fallbackResume];
  const resumeFileNames = new Set(allResumeFiles.map((f) => f.name));

  for (const file of allResumeFiles) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const rawText = await extractTextFromFile(buffer, file.type);
      const parsed = await parseResumeText(rawText);

      const current = await prisma.consultant.findUnique({ where: { id: consultant.id } });
      const updateData: Record<string, unknown> = {};
      if (current) {
        if (!current.phone && parsed.phone) updateData.phone = parsed.phone;
        if (!current.location && parsed.location) updateData.location = parsed.location;
        if (!current.title && parsed.title) updateData.title = parsed.title;
        if (!current.yearsExperience && parsed.yearsExperience) updateData.yearsExperience = parsed.yearsExperience;
        if (!current.summary && parsed.summary) updateData.summary = parsed.summary;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.consultant.update({ where: { id: consultant.id }, data: updateData });
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

      results.push({
        fileName: file.name,
        type: 'resume',
        message: `Saved as resume, ${parsed.keywords.length} keyword(s) tagged`,
      });
    } catch (err) {
      results.push({ fileName: file.name, type: 'error', message: (err as Error).message });
    }
  }

  const otherFiles = files.filter(
    (f) => !resumeFileNames.has(f.name) && IMAGE_OR_PDF.test(f.name) && !isExcludedFile(f.name)
  );

  for (const file of otherFiles) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const detected = await parseTicketDocument(buffer, file.type);

      if (detected.length === 0) {
        results.push({ fileName: file.name, type: 'skipped', message: "Couldn't detect a certification in this file" });
        continue;
      }

      for (const cert of detected) {
        const ticketType = cert.matchedTicketTypeId
          ? { id: cert.matchedTicketTypeId }
          : await resolveTicketType(file.name.replace(/\.(pdf|jpg|jpeg|png|gif|webp)$/i, ''));

        if (!ticketType) {
          results.push({ fileName: file.name, type: 'skipped', message: `"${cert.label}" — no matching ticket type` });
          continue;
        }

        const documentKey = `ticket-documents/${consultant.id}/${Date.now()}-${file.name}`;
        const documentUrl = await uploadResumeFile(documentKey, buffer, file.type);

        const existingTicket = await prisma.ticket.findFirst({
          where: { consultantId: consultant.id, ticketTypeId: ticketType.id },
        });

        if (existingTicket) {
          await prisma.ticket.update({
            where: { id: existingTicket.id },
            data: {
              issueDate: cert.issueDate ? new Date(cert.issueDate) : existingTicket.issueDate,
              expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : existingTicket.expiryDate,
              documentUrl,
              expiryNoticeSentAt: null,
              expiryNotice30SentAt: null,
            },
          });
        } else {
          await prisma.ticket.create({
            data: {
              consultantId: consultant.id,
              ticketTypeId: ticketType.id,
              issueDate: cert.issueDate ? new Date(cert.issueDate) : new Date(),
              expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
              documentUrl,
            },
          });
        }

        results.push({
          fileName: file.name,
          type: 'ticket',
          message: `${cert.label} — ${cert.confidence < 0.6 ? 'low confidence, please double-check dates' : 'saved'}`,
        });
      }
    } catch (err) {
      results.push({ fileName: file.name, type: 'error', message: (err as Error).message });
    }
  }

  const skippedForSafety = files.filter((f) => isExcludedFile(f.name) && !resumeFileNames.has(f.name));
  for (const f of skippedForSafety) {
    results.push({ fileName: f.name, type: 'skipped', message: 'Skipped for safety (sensitive filename)' });
  }

  return NextResponse.json({ results });
}

