import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ParsedKeyword {
  label: string;
  type: 'FORMATION' | 'RIG_TYPE' | 'SKILL' | 'CERTIFICATION' | 'SOFTWARE';
  confidence: number; // 0-1
}

export interface ParsedResume {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  title?: string;
  yearsExperience?: number;
  summary?: string;
  keywords: ParsedKeyword[];
}

const EXTRACTION_PROMPT = `You are extracting structured data from an oil & gas industry resume for a staffing database.

Read the resume text and return ONLY a JSON object (no markdown fences, no preamble) with this exact shape:

{
  "fullName": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,       // city and province, e.g. "Grande Prairie, AB" — if only one is present, include just that
  "title": string | null,          // e.g. "Drilling Engineer", "Wellsite Geologist"
  "yearsExperience": number | null,
  "summary": string | null,        // 2-3 sentence professional summary, in your own words
  "keywords": [
    { "label": string, "type": "FORMATION" | "RIG_TYPE" | "SKILL" | "CERTIFICATION" | "SOFTWARE", "confidence": number }
  ]
}

Rules for keywords:
- FORMATION: named Western Canadian geological formations/basins the person has worked (e.g. "Montney", "Duvernay", "Cardium", "Viking", "Clearwater"). This is a Western Canadian oil & gas company — do not tag US formations (e.g. Permian, Eagle Ford, Marcellus) even if mentioned; if a US formation is the only thing mentioned, skip it rather than mistranslating it to a Canadian one.
- RIG_TYPE: rig types worked on, using Western Canadian terminology (e.g. "Pad-Walking Rig", "Super-Single Rig", "Double Rig", "Triple Rig", "Service Rig (Workover Rig)", "Snubbing Unit").
- SKILL: technical/domain skills (e.g. "Directional Drilling", "Well Control", "Mud Logging", "Reservoir Engineering", "Steam-Assisted Gravity Drainage (SAGD)", "Managed Pressure Drilling (MPD)", "Underbalanced Drilling (UBD)", "High-Pressure High-Temperature (HPHT)").
- CERTIFICATION: named certifications (e.g. "IWCF", "IADC RigPass", "H2S Alive", "CSTS-09").
- SOFTWARE: named software/tools (e.g. "Petrel", "Landmark", "OpenWells", "Techlog", "PetroSight", "WellView", "CMG", "GeoScout", "AccuMap", "Petrinex", "OFM", "PipeSim").
- Normalize labels to a consistent canonical form matching how they're commonly written (e.g. "Montney" not "montney formation").
- Only include a keyword if it is clearly supported by the resume text. confidence should reflect how explicit the match is (1.0 = named directly, 0.6-0.8 = reasonably inferred from context, below 0.6 = don't include it).
- Do not invent formations, rigs, or certifications that are not mentioned or clearly implied.

Resume text:
"""
{{RESUME_TEXT}}
"""`;

export async function parseResumeText(resumeText: string): Promise<ParsedResume> {
  const prompt = EXTRACTION_PROMPT.replace('{{RESUME_TEXT}}', resumeText.slice(0, 15000));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from resume parser');
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as ParsedResume;
    // Defensive defaults
    parsed.keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse resume extraction response: ${(err as Error).message}`);
  }
}

// Extract raw text from an uploaded file buffer based on its type.
export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  let text: string;

  if (mimeType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    text = data.text;
  } else if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = (await import('mammoth')).default;
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    // Fallback: assume plain text
    text = buffer.toString('utf-8');
  }

  return sanitizeExtractedText(text);
}

// Postgres text columns reject embedded null bytes (0x00) outright, which can show up when a
// non-document file (e.g. a corrupted file, a Word lock file, or other binary junk) gets
// accidentally run through here. Stripping them keeps a bad file from crashing the whole import
// instead of just producing a garbled/empty result for that one file.
function sanitizeExtractedText(text: string): string {
  return text.replace(/\u0000/g, '');
}

// Regenerates just the summary paragraph - used when the admin wants a fresh AI attempt
// without re-running the full resume parse (which would also re-tag keywords, etc.)
export async function regenerateConsultantSummary(
  rawText: string,
  firstName: string,
  lastName: string,
  title: string | null
): Promise<string> {
  const prompt = `Write a 3-5 sentence, third-person professional summary for an oil & gas
consultant, based on their resume text below. Mention their name (${firstName} ${lastName}),
their role${title ? ` (${title})` : ''}, years of experience, and key technical areas (specific
formations, rig types, drilling/completions techniques, safety record) if actually mentioned in
the resume. Confident, specific, professional tone. Never invent facts not present in the
resume text. Return ONLY the summary paragraph - no preamble, no quotation marks, no markdown.

Resume text:
"""
${rawText.slice(0, 15000)}
"""`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No response from summary generation');
  }

  return textBlock.text.trim().replace(/^["']|["']$/g, '');
}

