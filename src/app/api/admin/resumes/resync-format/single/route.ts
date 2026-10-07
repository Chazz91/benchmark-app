import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { generatePolishedResume, resolveResumeTitle, resolveResumeTickets } from '@/lib/polishedResumeGenerator';

export const maxDuration = 60;

// POST { consultantId } - regenerates one consultant's "Benchmark Format" resume from
// scratch (fresh AI reformat + current template) and replaces whatever Benchmark-format
// resumes they already had with a new PDF+docx pair. One consultant per request, same
// reasoning as the PDF backfill's single endpoint: each regeneration needs its own Claude
// call, so bundling many into one request is what makes a batch job hang or time out.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { consultantId } = await request.json();
  if (!consultantId) return NextResponse.json({ error: 'consultantId is required' }, { status: 400 });

  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    include: {
      resumes: { orderBy: { createdAt: 'desc' } },
      tickets: { include: { ticketType: true }, orderBy: { ticketType: { label: 'asc' } } },
    },
  });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const name = `${consultant.firstName} ${consultant.lastName}`;
  const sourceResume = consultant.resumes.find((r) => !r.isFormatted && r.rawText);

  if (!sourceResume || !sourceResume.rawText) {
    return NextResponse.json({ name, status: 'skipped', message: 'No original resume with readable text found' });
  }

  try {
    const onFileTicketLabels = consultant.tickets.map((t) => t.ticketType.label);
    const ticketLabels = resolveResumeTickets(consultant.discipline, onFileTicketLabels, consultant.officeBased);
    const { pdfBuffer, docxBuffer } = await generatePolishedResume(
      sourceResume.rawText,
      ticketLabels,
      name,
      resolveResumeTitle(consultant.discipline, consultant.title, consultant.officeBased)
    );

    const baseName = `${name} - Benchmark Resume`;
    const timestamp = Date.now();
    const [pdfUrl, docxUrl] = await Promise.all([
      uploadResumeFile(`resumes/${consultant.id}/${timestamp}-benchmark-format.pdf`, pdfBuffer, 'application/pdf'),
      uploadResumeFile(
        `resumes/${consultant.id}/${timestamp}-benchmark-format.docx`,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ),
    ]);

    // Replace every existing Benchmark-format resume for this consultant with the freshly
    // regenerated pair, rather than leaving old-template copies sitting alongside the new one.
    await prisma.resume.deleteMany({ where: { consultantId: consultant.id, isFormatted: true } });
    await prisma.resume.create({
      data: {
        consultantId: consultant.id,
        fileName: `${baseName}.pdf`,
        fileUrl: pdfUrl,
        isFormatted: true,
        parsedAt: new Date(),
      },
    });
    await prisma.resume.create({
      data: {
        consultantId: consultant.id,
        fileName: `${baseName}.docx`,
        fileUrl: docxUrl,
        isFormatted: true,
        parsedAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'RESYNCED_RESUME_FORMAT',
        entityType: 'Consultant',
        entityId: consultant.id,
      },
    });

    return NextResponse.json({ name, status: 'updated', message: 'Regenerated with the latest format' });
  } catch (err) {
    return NextResponse.json({ name, status: 'error', message: (err as Error).message });
  }
}
