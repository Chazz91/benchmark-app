import Anthropic from '@anthropic-ai/sdk';
import PDFDocument from 'pdfkit';
import { BENCHMARK_LOGO_BASE64 } from '@/lib/benchmarkLogo';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface JobEntry {
  dateRange: string;
  company: string;
  title: string;
  bullets: string[];
}

export interface StructuredResume {
  summary: string;
  jobs: JobEntry[];
}

const REFORMAT_PROMPT = `You are reformatting an oil & gas consultant's resume into a polished, professional
format for a staffing agency (Benchmark Engineering) to present to clients.

Read the resume text below and return ONLY a JSON object (no markdown fences, no preamble)
with this exact shape:

{
  "summary": string,   // 3-5 sentences, third person, professional tone - mention the person's
                        // name, their role/title, years of experience, and key technical
                        // areas (specific formations, rig types, drilling/completions
                        // techniques, safety record) IF actually mentioned in the resume.
  "jobs": [
    {
      "dateRange": string,   // e.g. "2022 -- Present" or "2019 -- 2020"
      "company": string,     // company name and location, e.g. "Athabasca Oil Corp., Leismer & Kaybob"
      "title": string,       // their job title at this position
      "bullets": string[]    // 3-5 bullet points describing responsibilities/achievements in
                              // this role, using specific technical details from the resume
                              // where available (well depths, rig types, formations, safety
                              // metrics, crew size, etc.)
    }
  ]
}

Critical rules:
- Include EVERY job/position mentioned in the original resume, in reverse chronological order
  (most recent first) - do not drop or merge positions.
- Never invent specific facts, numbers, well depths, safety records, or achievements that
  aren't in the original resume. If a role has less detail in the source material, write
  fewer but accurate bullets, or write bullets that describe the role in professional,
  general terms appropriate for that job title and company - do not fabricate specific
  metrics to hit a bullet count.
- Aim for 3-5 bullets per role when the source material supports it, but accuracy always
  comes before hitting that number.
- Keep the tone matching a polished professional resume: confident, specific, achievement
  and responsibility focused.

Resume text:
"""
{{RESUME_TEXT}}
"""`;

async function reformatResumeContent(rawText: string): Promise<StructuredResume> {
  const prompt = REFORMAT_PROMPT.replace('{{RESUME_TEXT}}', rawText.slice(0, 20000));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No response from resume reformatting');
  }

  const rawResponse = textBlock.text.trim();
  const objectMatch = rawResponse.match(/\{[\s\S]*\}/);
  const cleaned = (objectMatch ? objectMatch[0] : rawResponse).replace(/```json|```/g, '').trim();

  const parsed = JSON.parse(cleaned) as StructuredResume;
  if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
  return parsed;
}

const NAVY = '#1F4E79';
const ACCENT_BLUE = '#4472C4';
const PAGE_MARGIN = { top: 60, bottom: 100, left: 60, right: 60 };

function sectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(text, { underline: true });
  doc.moveDown(0.2);
}

// Draws the contact footer on whichever page is currently active. Writing below the normal
// margin is what pdfkit uses to decide a page is full and insert a new one, so the bottom
// margin is dropped to zero for the duration of this call and restored right after.
function addFooter(doc: PDFKit.PDFDocument) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const footerTop = doc.page.height - PAGE_MARGIN.bottom + 20;

  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.moveTo(left, footerTop).lineTo(right, footerTop).lineWidth(1).strokeColor('black').stroke();
  doc.x = left;
  doc.y = footerTop + 6;
  doc.font('Helvetica').fontSize(8).fillColor('black');
  doc.text('Benchmark Engineering Inc', { width: right - left, align: 'center' });
  doc.text('Suite 810, 396 - 11th Ave S.W. Calgary, AB T2R 0C5', { width: right - left, align: 'center' });
  doc.text('Phone (403) 266-5757  Fax (403) 266-5730', { width: right - left, align: 'center' });
  doc.text('Contact: Nels Eckland (403) 605-2684', { width: right - left, align: 'center' });

  doc.page.margins.bottom = originalBottomMargin;
}

// Builds the polished, Benchmark-branded resume as a PDF rather than a Word document.
// Mobile browsers have no built-in viewer for .docx (see src/lib/fileDisplay.ts /
// src/lib/storage.ts's INLINE_EXTENSIONS) and force it through a download-then-open-in-
// another-app flow. PDFs render inline everywhere - phone, tablet, desktop - with no third
// party viewer involved, so generating one directly is what makes "tap the link, see the
// resume" actually work on mobile for this document the way it already does for uploads.
export function buildResumePdf(
  structured: StructuredResume,
  ticketLabels: string[],
  consultantName: string,
  consultantTitle: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const headerTop = doc.y;

    doc.image(Buffer.from(BENCHMARK_LOGO_BASE64, 'base64'), left, headerTop, { width: 110 });
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(NAVY)
      .text(consultantName, left, headerTop + 10, { width: contentWidth, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(ACCENT_BLUE)
      .text(consultantTitle || '', left, headerTop + 10, { width: contentWidth, align: 'right' });

    const dividerY = headerTop + 55;
    doc
      .moveTo(left, dividerY)
      .lineTo(doc.page.width - doc.page.margins.right, dividerY)
      .lineWidth(3)
      .strokeColor('black')
      .stroke();
    doc.x = left;
    doc.y = dividerY + 14;
    doc.fillColor('black');

    sectionHeading(doc, 'SUMMARY OF EXPERIENCE');
    doc.font('Helvetica').fontSize(10).fillColor('black').text(structured.summary, { align: 'justify' });

    sectionHeading(doc, 'EXPERIENCE');
    structured.jobs.forEach((job) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(job.dateRange);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('black').text(job.company);
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('black').text(job.title);
      doc.moveDown(0.2);
      if (job.bullets.length > 0) {
        doc.font('Helvetica').fontSize(10).list(job.bullets, { bulletRadius: 1.5, textIndent: 14 });
      }
      doc.moveDown(0.5);
    });

    sectionHeading(doc, 'EDUCATION/TICKETS');
    if (ticketLabels.length > 0) {
      doc.font('Helvetica').fontSize(10).list(ticketLabels, { bulletRadius: 1.5, textIndent: 14 });
    } else {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('black').text('None on file yet');
    }

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text('REFERENCES', { continued: true, underline: true });
    doc.font('Helvetica-Oblique').text('   Available upon request');

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      addFooter(doc);
    }

    doc.end();
  });
}

export async function generatePolishedResume(
  rawResumeText: string,
  ticketLabels: string[],
  consultantName: string,
  consultantTitle: string
): Promise<Buffer> {
  const structured = await reformatResumeContent(rawResumeText);
  return buildResumePdf(structured, ticketLabels, consultantName, consultantTitle);
}