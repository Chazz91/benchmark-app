import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { generatePolishedResume, resolveResumeTitle, resolveResumeTickets } from '@/lib/polishedResumeGenerator';

// POST - generates a polished, Benchmark-branded Word resume from the consultant's most
// recent original resume on file, plus their actual on-file tickets (which naturally
// differ between a drilling consultant and a completions consultant, since each only
// holds the certifications relevant to them).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'RECRUITER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const consultant = await prisma.consultant.findUnique({
    where: { id: params.id },
    include: {
      resumes: { orderBy: { createdAt: 'desc' } },
      tickets: { include: { ticketType: true }, orderBy: { ticketType: { label: 'asc' } } },
    },
  });
  if (!consultant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Use the most recent original (non-formatted) resume as the source material
  const sourceResume = consultant.resumes.find((r) => !r.isFormatted);
  if (!sourceResume || !sourceResume.rawText) {
    return NextResponse.json(
      { error: 'No original resume with readable text found for this consultant' },
      { status: 400 }
    );
  }

  const onFileTicketLabels = consultant.tickets.map((t) => t.ticketType.label);
  const ticketLabels = resolveResumeTickets(consultant.discipline, onFileTicketLabels, consultant.officeBased);

  try {
    const name = `${consultant.firstName} ${consultant.lastName}`;
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

    // Two resume rows from one generation: the PDF is the "view" copy (opens inline
    // everywhere, including mobile), the .docx is the same content for downloading and
    // editing directly in Word/Google Docs on a laptop. Plain sequential creates rather than
    // $transaction - an interactive transaction needs its own dedicated connection to Neon
    // (unlike the plain queries this app otherwise routes over HTTP, see src/lib/prisma.ts),
    // and that connection attempt can time out on a cold serverless invocation.
    const resume = await prisma.resume.create({
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

    return NextResponse.json({ resume });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}