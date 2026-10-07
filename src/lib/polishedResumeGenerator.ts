import Anthropic from '@anthropic-ai/sdk';
import PDFDocument from 'pdfkit';
import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  UnderlineType,
  ImageRun,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
  Footer,
} from 'docx';
import { BENCHMARK_LOGO_BASE64 } from '@/lib/benchmarkLogo';
import {
  CARLITO_REGULAR_BASE64,
  CARLITO_BOLD_BASE64,
  CARLITO_ITALIC_BASE64,
} from '@/lib/carlitoFont';

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

// Drilling and Completions consultants are always presented to clients under the same
// generic field role, regardless of whatever their actual internal title is on file.
const WELLSITE_SUPERVISOR_DISCIPLINES = new Set(['DRILLING', 'COMPLETIONS']);

export function resolveResumeTitle(discipline: string, title: string | null | undefined): string {
  if (WELLSITE_SUPERVISOR_DISCIPLINES.has(discipline)) return 'Wellsite Supervisor';
  return title || '';
}

const PDF_NAVY = '#1F4E79';
const PDF_ACCENT_BLUE = '#4472C4';
// Matches the original Word template's page setup (0.5in top, 0.625in sides, 0.75in bottom)
// converted from twips to points (1pt = 20 twips) - the bottom margin is enlarged beyond the
// original 45pt because our footer is drawn manually into reserved space rather than relying
// on Word's own footer area, which needs more clearance to fit four lines without crowding.
const PAGE_MARGIN = { top: 36, bottom: 100, left: 54, right: 54 };
const BODY_SIZE = 11; // the Word template never overrode its base font size
// Column proportions from the original two/three-column tables (1800/7560 and
// 2400/4560/2400 twips) - kept as ratios since our content width differs slightly from the
// original's hardcoded table width.
const DATE_COL_RATIO = 1800 / 9360;
const LOGO_COL_RATIO = 2400 / 9360;
const NAME_COL_RATIO = 4560 / 9360;
const GUTTER = 10; // approximates Word's default table-cell padding between adjacent columns

function addPdfSectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.x = doc.page.margins.left;
  doc.y += 15; // spacing before: 300 twips
  doc.font('Carlito-Bold').fontSize(BODY_SIZE).fillColor('black').text(text, { underline: true });
  doc.y += 6; // spacing after: 120 twips
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
  doc.font('Carlito').fontSize(8).fillColor('black');
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

    doc.registerFont('Carlito', Buffer.from(CARLITO_REGULAR_BASE64, 'base64'));
    doc.registerFont('Carlito-Bold', Buffer.from(CARLITO_BOLD_BASE64, 'base64'));
    doc.registerFont('Carlito-Italic', Buffer.from(CARLITO_ITALIC_BASE64, 'base64'));

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // --- Header: logo | name (centered) | title (right-aligned), as three columns matching
    // the original Word template's 2400:4560:2400 twip table ---
    const logoColWidth = contentWidth * LOGO_COL_RATIO;
    const nameColWidth = contentWidth * NAME_COL_RATIO;
    const titleColWidth = contentWidth * LOGO_COL_RATIO;
    const headerTop = doc.y;

    doc.image(Buffer.from(BENCHMARK_LOGO_BASE64, 'base64'), left, headerTop, { width: 139 });
    doc
      .font('Carlito-Bold')
      .fontSize(16)
      .fillColor(PDF_NAVY)
      .text(consultantName, left + logoColWidth + GUTTER, headerTop + 10, {
        width: nameColWidth - GUTTER * 2,
        align: 'center',
      });
    doc
      .font('Carlito')
      .fontSize(10)
      .fillColor(PDF_ACCENT_BLUE)
      .text(consultantTitle || '', left + logoColWidth + nameColWidth + GUTTER, headerTop + 10, {
        width: titleColWidth - GUTTER,
        align: 'right',
      });

    // Thick divider bar under the header, matching the template's bold horizontal rule
    const dividerY = headerTop + 42;
    doc
      .moveTo(left, dividerY)
      .lineTo(doc.page.width - doc.page.margins.right, dividerY)
      .lineWidth(3)
      .strokeColor('black')
      .stroke();
    doc.x = left;
    doc.y = dividerY + 14;
    doc.fillColor('black');

    addPdfSectionHeading(doc, 'SUMMARY OF EXPERIENCE');
    doc.font('Carlito').fontSize(BODY_SIZE).fillColor('black').text(structured.summary, { align: 'justify' });

    // --- Experience: two-column rows (narrow date column | company/title/bullets column),
    // matching the original Word template's 1800:7560 twip job tables ---
    addPdfSectionHeading(doc, 'EXPERIENCE');
    const dateColWidth = contentWidth * DATE_COL_RATIO;
    const roleColX = left + dateColWidth + GUTTER;
    const roleColWidth = contentWidth - dateColWidth - GUTTER;

    structured.jobs.forEach((job) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
      const rowTop = doc.y;

      doc.font('Carlito-Bold').fontSize(BODY_SIZE).fillColor('black').text(job.dateRange, left, rowTop, {
        width: dateColWidth,
      });

      doc.x = roleColX;
      doc.y = rowTop;
      doc.font('Carlito-Bold').fontSize(BODY_SIZE).fillColor('black').text(job.company, { width: roleColWidth });
      doc.font('Carlito-Italic').fontSize(BODY_SIZE).fillColor('black').text(job.title, { width: roleColWidth });
      doc.y += 3; // spacing after the title line: 60 twips
      if (job.bullets.length > 0) {
        doc.x = roleColX;
        doc.font('Carlito').fontSize(BODY_SIZE).list(job.bullets, { width: roleColWidth, bulletRadius: 1.5, textIndent: 14 });
      }

      doc.x = left;
      doc.y += 8; // gap between job entries
    });

    addPdfSectionHeading(doc, 'EDUCATION/TICKETS');
    if (ticketLabels.length > 0) {
      doc.font('Carlito').fontSize(BODY_SIZE).list(ticketLabels, { bulletRadius: 1.5, textIndent: 14 });
    } else {
      doc.font('Carlito-Italic').fontSize(BODY_SIZE).fillColor('black').text('None on file yet');
    }

    // --- References: same two-column layout as the job rows ---
    doc.x = left;
    doc.y += 10;
    const refRowTop = doc.y;
    doc
      .font('Carlito-Bold')
      .fontSize(BODY_SIZE)
      .fillColor('black')
      .text('REFERENCES', left, refRowTop, { width: dateColWidth, underline: true });
    doc
      .font('Carlito-Italic')
      .fontSize(BODY_SIZE)
      .fillColor('black')
      .text('Available upon request', roleColX, refRowTop, { width: roleColWidth });

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      addFooter(doc);
    }

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Word (editable) generation - the same content as the PDF above, as a .docx a consultant's
// coordinator can download and edit directly in Word/Google Docs (wording tweaks, formatting
// touch-ups) without needing an in-app editor. The PDF stays the "view" copy since it's the
// one that opens inline on mobile; this is purely for local editing on a laptop.
// ---------------------------------------------------------------------------

const DOCX_NAVY = '1F4E79';
const DOCX_ACCENT_BLUE = '4472C4';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDERLESS_CELL_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ font: 'Calibri',  text, bold: true, underline: { type: UnderlineType.SINGLE } })],
  });
}

// Header row: logo (left) | consultant name (center, large navy) | title (right, blue)
function buildHeaderTable(consultantName: string, consultantTitle: string): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 4560, 2400],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: Buffer.from(BENCHMARK_LOGO_BASE64, 'base64'),
                    transformation: { width: 185, height: 49 },
                    type: 'jpg',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4560, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ font: 'Calibri',  text: consultantName, bold: true, size: 32, color: DOCX_NAVY }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ font: 'Calibri',  text: consultantTitle, color: DOCX_ACCENT_BLUE, size: 20 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// Thick black divider bar, matching the template's bold horizontal rule under the header
function buildDividerBar(): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: '000000' } },
    children: [],
  });
}

// Two-column job entry: narrow left column for the date range, wide right column for
// company/title/bullets - matching the template's layout exactly.
function buildJobTable(job: JobEntry): Table {
  const rightCellChildren: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ font: 'Calibri',  text: job.company, bold: true })] }),
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ font: 'Calibri',  text: job.title, italics: true })],
    }),
    ...job.bullets.map(
      (bullet) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ font: 'Calibri',  text: bullet })],
        })
    ),
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 7560],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ font: 'Calibri',  text: job.dateRange, bold: true })] })],
          }),
          new TableCell({
            width: { size: 7560, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            children: rightCellChildren,
          }),
        ],
      }),
    ],
  });
}

// Two-column "REFERENCES  |  Available upon request" row, matching the template
function buildReferencesTable(): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 7560],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            children: [
              new Paragraph({
                children: [new TextRun({ font: 'Calibri',  text: 'REFERENCES', bold: true, underline: { type: UnderlineType.SINGLE } })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 7560, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ font: 'Calibri',  text: 'Available upon request', italics: true })] })],
          }),
        ],
      }),
    ],
  });
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000' } },
        spacing: { before: 100 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ font: 'Calibri',  text: 'Benchmark Engineering Inc', size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ font: 'Calibri',  text: 'Suite 810, 396 - 11th Ave S.W. Calgary, AB T2R 0C5', size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ font: 'Calibri',  text: 'Phone (403) 266-5757  Fax (403) 266-5730', size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ font: 'Calibri',  text: 'Contact: Nels Eckland (403) 605-2684', size: 16 })],
      }),
    ],
  });
}

// Pure document builder - no API calls - so it can be tested directly with fixture data
export function buildResumeDocument(
  structured: StructuredResume,
  ticketLabels: string[],
  consultantName: string,
  consultantTitle: string
): Document {
  const summaryHeading = sectionHeading('SUMMARY OF EXPERIENCE');
  const summaryParagraph = new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ font: 'Calibri',  text: structured.summary })],
  });

  const experienceHeading = sectionHeading('EXPERIENCE');
  const jobBlocks: (Table | Paragraph)[] = [];
  structured.jobs.forEach((job) => {
    jobBlocks.push(buildJobTable(job));
    jobBlocks.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  });

  const ticketsHeading = sectionHeading('EDUCATION/TICKETS');
  const ticketParagraphs =
    ticketLabels.length > 0
      ? ticketLabels.map(
          (label) =>
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: [new TextRun({ font: 'Calibri',  text: label })],
            })
        )
      : [new Paragraph({ children: [new TextRun({ font: 'Calibri',  text: 'None on file yet', italics: true })] })];

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 720, bottom: 900, left: 1080, right: 1080 },
          },
        },
        footers: { default: buildFooter() },
        children: [
          buildHeaderTable(consultantName, consultantTitle),
          buildDividerBar(),
          summaryHeading,
          summaryParagraph,
          experienceHeading,
          ...jobBlocks,
          ticketsHeading,
          ...ticketParagraphs,
          new Paragraph({ spacing: { before: 200 }, children: [] }),
          buildReferencesTable(),
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Orchestration - runs the AI reformat once, then builds both files off the same content
// ---------------------------------------------------------------------------

export interface GeneratedResumeFiles {
  pdfBuffer: Buffer;
  docxBuffer: Buffer;
}

export async function generatePolishedResume(
  rawResumeText: string,
  ticketLabels: string[],
  consultantName: string,
  consultantTitle: string
): Promise<GeneratedResumeFiles> {
  const structured = await reformatResumeContent(rawResumeText);
  const [pdfBuffer, docxBuffer] = await Promise.all([
    buildResumePdf(structured, ticketLabels, consultantName, consultantTitle),
    Packer.toBuffer(buildResumeDocument(structured, ticketLabels, consultantName, consultantTitle)),
  ]);
  return { pdfBuffer, docxBuffer };
}