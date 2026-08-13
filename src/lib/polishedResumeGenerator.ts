import Anthropic from '@anthropic-ai/sdk';
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

const NAVY = '1F4E79';
const ACCENT_BLUE = '4472C4';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDERLESS_CELL_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text, bold: true, underline: { type: UnderlineType.SINGLE } })],
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
                  new TextRun({ text: consultantName, bold: true, size: 32, color: NAVY }),
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
                children: [new TextRun({ text: consultantTitle, color: ACCENT_BLUE, size: 20 })],
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
    new Paragraph({ children: [new TextRun({ text: job.company, bold: true })] }),
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: job.title, italics: true })],
    }),
    ...job.bullets.map(
      (bullet) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: bullet })],
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
            children: [new Paragraph({ children: [new TextRun({ text: job.dateRange, bold: true })] })],
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
                children: [new TextRun({ text: 'REFERENCES', bold: true, underline: { type: UnderlineType.SINGLE } })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 7560, type: WidthType.DXA },
            borders: BORDERLESS_CELL_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ text: 'Available upon request', italics: true })] })],
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
        children: [new TextRun({ text: 'Benchmark Engineering Inc', size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Suite 810, 396 - 11th Ave S.W. Calgary, AB T2R 0C5', size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Phone (403) 266-5757  Fax (403) 266-5730', size: 16 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Contact: Nels Eckland (403) 605-2684', size: 16 })],
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
    children: [new TextRun({ text: structured.summary })],
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
              children: [new TextRun({ text: label })],
            })
        )
      : [new Paragraph({ children: [new TextRun({ text: 'None on file yet', italics: true })] })];

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

export async function generatePolishedResume(
  rawResumeText: string,
  ticketLabels: string[],
  consultantName: string,
  consultantTitle: string
): Promise<Buffer> {
  const structured = await reformatResumeContent(rawResumeText);
  const doc = buildResumeDocument(structured, ticketLabels, consultantName, consultantTitle);
  return Packer.toBuffer(doc);
}