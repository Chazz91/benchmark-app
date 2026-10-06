import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { generatePolishedResume } from '@/lib/polishedResumeGenerator';

export const maxDuration = 60;

// POST { resumeId } - regenerates a single stale "Benchmark Format" .docx resume as a PDF,
// from the consultant's current tickets and most recent original resume, and repoints the
// existing resume record at it. Kept to one resume per request - each one needs its own
// Claude call to reformat the source resume, and bundling many of those into a single
// request is exactly what made the old all-in-one backfill endpoint take minutes and risk
// the serverless function timing out before it finished. The admin UI calls this once per
// stale resume, in sequence, so a large batch can't time out no matter how many there are.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resumeId } = await request.json();
  if (!resumeId) return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: {
      consultant: {
        include: {
          resumes: { orderBy: { createdAt: 'desc' } },
          tickets: { include: { ticketType: true }, orderBy: { ticketType: { label: 'asc' } } },
        },
      },
    },
  });
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const consultant = resume.consultant;
  const name = `${consultant.firstName} ${consultant.lastName}`;
  const sourceResume = consultant.resumes.find((r) => !r.isFormatted && r.rawText);

  if (!sourceResume || !sourceResume.rawText) {
    return NextResponse.json({ name, status: 'skipped', message: 'No original resume with readable text found' });
  }

  try {
    const ticketLabels = consultant.tickets.map((t) => t.ticketType.label);
    const { pdfBuffer, docxBuffer } = await generatePolishedResume(
      sourceResume.rawText,
      ticketLabels,
      name,
      consultant.title || ''
    );

    const baseName = `${name} - Benchmark Resume`;
    const timestamp = Date.now();
    const [fileUrl, editableFileUrl] = await Promise.all([
      uploadResumeFile(`resumes/${consultant.id}/${timestamp}-benchmark-format.pdf`, pdfBuffer, 'application/pdf'),
      uploadResumeFile(
        `resumes/${consultant.id}/${timestamp}-benchmark-format.docx`,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ),
    ]);

    await prisma.resume.update({
      where: { id: resume.id },
      data: {
        fileName: `${baseName}.pdf`,
        fileUrl,
        editableFileName: `${baseName}.docx`,
        editableFileUrl,
        parsedAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'BACKFILLED_RESUME_PDF',
        entityType: 'Resume',
        entityId: resume.id,
      },
    });

    return NextResponse.json({ name, status: 'updated', message: 'Regenerated as PDF' });
  } catch (err) {
    return NextResponse.json({ name, status: 'error', message: (err as Error).message });
  }
}
