import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadResumeFile } from '@/lib/storage';
import { generatePolishedResume } from '@/lib/polishedResumeGenerator';

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

  const ticketLabels = consultant.tickets.map((t) => t.ticketType.label);

  try {
    const buffer = await generatePolishedResume(
      sourceResume.rawText,
      ticketLabels,
      `${consultant.firstName} ${consultant.lastName}`,
      consultant.title || ''
    );

    const fileName = `${consultant.firstName} ${consultant.lastName} - Benchmark Resume.docx`;
    const key = `resumes/${consultant.id}/${Date.now()}-benchmark-format.docx`;
    const fileUrl = await uploadResumeFile(
      key,
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    const resume = await prisma.resume.create({
      data: {
        consultantId: consultant.id,
        fileName,
        fileUrl,
        isFormatted: true,
        parsedAt: new Date(),
      },
    });

    return NextResponse.json({ resume });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

