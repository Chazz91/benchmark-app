import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { extractTextFromFile, parseResumeText } from '@/lib/resumeParser';
import { resolveOrCreateKeyword } from '@/lib/keywords';
import { parseTicketDocument } from '@/lib/ticketDocumentParser';
import { resolveTicketType } from '@/lib/resolveTicketType';

const RESUME_NAME_HINTS = ['resume', 'cv'];
const IMAGE_OR_PDF = /\.(pdf|jpg|jpeg|png|gif|webp)$/i;

// Any filename containing one of these is skipped entirely - never uploaded, never sent to
// Claude for reading, never touched at all. This is a safety net in case banking, tax, or
// other sensitive company documents happen to be mixed into the same folder as a resume.
const EXCLUDED_NAME_HINTS = [
  'void', 'cheque', 'check', 'bank', 'banking', 'direct deposit', 'deposit',
  'invoice', 'tax', 'sin', 'social insurance', 'insurance number', 't4', 't4a',
  'payroll', 'wage', 'salary', 'confidential', 'contract', 'agreement', 'nda',
];

function isExcludedFile(fileName: string) {
  const lower = fileName.toLowerCase();
  if (EXCLUDED_NAME_HINTS.some((hint) => lower.includes(hint))) return true;

  // System/junk/temp files that are never real documents, no matter what they're named -
  // e.g. "~$Resume.docx" is a Microsoft Word lock file (created automatically whenever
  // someone has that document open), not the actual resume, and its contents are garbage
  // binary data that would crash things if parsed as if it were real text.
  const baseName = fileName.split('/').pop() || fileName;
  if (baseName.startsWith('~$')) return true;
  if (baseName.startsWith('.')) return true; // e.g. .DS_Store
  if (/^thumbs\.db$/i.test(baseName)) return true;
  if (/^desktop\.ini$/i.test(baseName)) return true;

  return false;
}

interface FolderResult {
  folderName: string;
  consultantName?: string;
  resumeFile?: string;
  status: 'created' | 'updated' | 'error';
  ticketsCreated: number;
  ticketsNeedingReview: string[]; // labels that were detected but need a manual date/type check
  filesSkippedForSafety?: string[]; // sensitive-named files that were never opened or processed at all
  message?: string;
}

// POST multipart/form-data with:
//   files: every file, in any order
//   paths: matching array of each file's folder-relative path (e.g. "John Smith/resume.pdf")
//
// Groups files by their top-level folder (assumed to be one consultant each). In each folder,
// picks the most likely resume (by filename, falling back to the first PDF/DOCX) and creates/
// updates that consultant from it. Every other file is treated as a certification/license
// document and read via the same AI ticket-scanning pipeline used for the single-photo scanner,
// creating Ticket records for whatever it can confidently match and date.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  const paths = formData.getAll('paths') as string[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files received' }, { status: 400 });
  }

  // Group files by their top-level folder name
  const groups = new Map<string, { file: File; path: string }[]>();
  files.forEach((file, i) => {
    const path = paths[i] || file.name;
    const folderName = path.split('/')[0] || 'Unsorted';
    if (!groups.has(folderName)) groups.set(folderName, []);
    groups.get(folderName)!.push({ file, path });
  });

  const results: FolderResult[] = [];

  for (const [folderName, groupFiles] of groups) {
    try {
      // 1. Find EVERY resume-like file (not just one) - some consultants have more than one
      // version on file, and each can fill in details the other is missing. Files matching
      // "resume"/"cv" in the name are preferred; if none exist, every PDF/DOCX is treated as a
      // candidate. Excluded/sensitive-named files are never eligible either way.
      let resumeEntries = groupFiles.filter(
        (f) => !isExcludedFile(f.file.name) && RESUME_NAME_HINTS.some((hint) => f.file.name.toLowerCase().includes(hint))
      );
      if (resumeEntries.length === 0) {
        resumeEntries = groupFiles.filter((f) => !isExcludedFile(f.file.name) && /\.(pdf|docx)$/i.test(f.file.name));
      }

      if (resumeEntries.length === 0) {
        results.push({
          folderName,
          status: 'error',
          ticketsCreated: 0,
          ticketsNeedingReview: [],
          message: 'No resume-like file (PDF/DOCX) found in this folder - skipped entirely',
        });
        continue;
      }

      let consultant: Awaited<ReturnType<typeof prisma.consultant.create>> | null = null;
      let isNew = false;
      let allKeywords: { label: string; type: 'FORMATION' | 'RIG_TYPE' | 'SKILL' | 'CERTIFICATION' | 'SOFTWARE'; confidence: number }[] = [];

      for (const resumeEntry of resumeEntries) {
        const resumeBuffer = Buffer.from(await resumeEntry.file.arrayBuffer());
        const rawText = await extractTextFromFile(resumeBuffer, resumeEntry.file.type);
        const parsed = await parseResumeText(rawText);
        allKeywords = allKeywords.concat(parsed.keywords);

        if (!consultant) {
          // First resume in the folder: find or create the consultant record
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

        // Every resume (first or subsequent) can fill in anything still blank -
        // this is exactly how a second resume version helps fill gaps the first one missed
        const updateData: Record<string, unknown> = {};
        if (!consultant.phone && parsed.phone) updateData.phone = parsed.phone;
        if (!consultant.location && parsed.location) updateData.location = parsed.location;
        if (!consultant.title && parsed.title) updateData.title = parsed.title;
        if (!consultant.yearsExperience && parsed.yearsExperience) updateData.yearsExperience = parsed.yearsExperience;
        if (!consultant.summary && parsed.summary) updateData.summary = parsed.summary;
        if (Object.keys(updateData).length > 0) {
          consultant = await prisma.consultant.update({ where: { id: consultant.id }, data: updateData });
        }

        // Save this resume file as its own record
        const resumeKey = `resumes/${consultant.id}/${Date.now()}-${resumeEntry.file.name}`;
        const resumeUrl = await uploadResumeFile(resumeKey, resumeBuffer, resumeEntry.file.type);
        await prisma.resume.create({
          data: {
            consultantId: consultant.id,
            fileName: resumeEntry.file.name,
            fileUrl: resumeUrl,
            rawText,
            parsedAt: new Date(),
          },
        });
      }

      if (!consultant) {
        results.push({
          folderName,
          status: 'error',
          ticketsCreated: 0,
          ticketsNeedingReview: [],
          message: 'Could not create or find a consultant record from the resume(s) in this folder',
        });
        continue;
      }

      // Tag keywords found across ALL resumes in this folder, combined
      for (const kw of allKeywords) {
        const keyword = await resolveOrCreateKeyword(kw.label, kw.type);
        await prisma.consultantKeyword.upsert({
          where: { consultantId_keywordId: { consultantId: consultant.id, keywordId: keyword.id } },
          update: { source: 'PARSED', confidence: kw.confidence },
          create: { consultantId: consultant.id, keywordId: keyword.id, source: 'PARSED', confidence: kw.confidence },
        });
      }

      // 2. Every other file: treat as a certification/license document
      let ticketsCreated = 0;
      const ticketsNeedingReview: string[] = [];

      const resumeEntryPaths = new Set(resumeEntries.map((r) => r.path));
      const skippedForSafety = groupFiles.filter((f) => isExcludedFile(f.file.name)).map((f) => f.file.name);

      const otherFiles = groupFiles.filter(
        (f) => !resumeEntryPaths.has(f.path) && IMAGE_OR_PDF.test(f.file.name) && !isExcludedFile(f.file.name)
      );

      for (const entry of otherFiles) {
        try {
          const buffer = Buffer.from(await entry.file.arrayBuffer());
          const detected = await parseTicketDocument(buffer, entry.file.type);

          for (const cert of detected) {
            // Fall back to matching the filename itself if the AI reading didn't match anything
            const ticketType = cert.matchedTicketTypeId
              ? { id: cert.matchedTicketTypeId }
              : await resolveTicketType(entry.file.name.replace(/\.(pdf|jpg|jpeg|png|gif|webp)$/i, ''));

            if (!ticketType) {
              ticketsNeedingReview.push(`${cert.label} (from ${entry.file.name}) — no matching ticket type`);
              continue;
            }

            if (!cert.issueDate || !cert.expiryDate || cert.confidence < 0.6) {
              ticketsNeedingReview.push(`${cert.label} (from ${entry.file.name}) — low confidence, check dates`);
            }

            const documentKey = `ticket-documents/${consultant.id}/${Date.now()}-${entry.file.name}`;
            const documentUrl = await uploadResumeFile(documentKey, buffer, entry.file.type);

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
            ticketsCreated++;
          }
        } catch (err) {
          ticketsNeedingReview.push(`${entry.file.name} — couldn't be read: ${(err as Error).message}`);
        }
      }

      results.push({
        folderName,
        consultantName: `${consultant.firstName} ${consultant.lastName}`,
        resumeFile: resumeEntries.map((r) => r.file.name).join(', '),
        status: isNew ? 'created' : 'updated',
        ticketsCreated,
        ticketsNeedingReview,
        filesSkippedForSafety: skippedForSafety,
      });
    } catch (err) {
      results.push({
        folderName,
        status: 'error',
        ticketsCreated: 0,
        ticketsNeedingReview: [],
        message: (err as Error).message,
      });
    }
  }

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'BULK_FOLDER_IMPORT',
      entityType: 'Consultant',
      entityId: 'bulk',
      metadata: { folders: groups.size, results: results.length },
    },
  });

  return NextResponse.json({ results });
}