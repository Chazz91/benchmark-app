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
  "summary": string | null,        // third person, information-dense — name EVERY employer in the work history (don't drop any for length), plus formations, rig types, and quantified experience actually stated in the resume, rather than generic filler ("skilled", "proven track record"); a shorter honest summary beats a padded vague one; do NOT mention certifications/tickets (H2S Alive, IWCF, RigPass, etc.) — those are tracked separately
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

export interface ServiceOrderDates {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
}

// Pulls the effective start/end dates out of a service order sheet's "Term" section
// (e.g. Cenovus service orders: "this Service Order shall start on 2026-05-26 and continue
// until 2027-05-25"). Used to auto-fill the date fields when one is uploaded, so staff don't
// have to retype dates that are already sitting in the document.
export async function extractServiceOrderDates(text: string): Promise<ServiceOrderDates> {
  const prompt = `Find the effective start and end dates in this service order / contract
document (usually in a "Term" section, e.g. "this Service Order shall start on 2026-05-26 and
continue until 2027-05-25"). Return ONLY a JSON object, no markdown fences, no preamble:

{ "startDate": "YYYY-MM-DD" | null, "endDate": "YYYY-MM-DD" | null }

If a date isn't clearly present, use null rather than guessing.

Document text:
"""
${text.slice(0, 15000)}
"""`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No response from service order date extraction');
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as ServiceOrderDates;
    return { startDate: parsed.startDate || null, endDate: parsed.endDate || null };
  } catch (err) {
    throw new Error(`Failed to parse service order date extraction response: ${(err as Error).message}`);
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
  const prompt = `Write a sharp, information-dense professional summary for an oil & gas
consultant, in the third person, based on the resume text below. This goes on a searchable
staffing profile, so it should read like a technical recruiter wrote it - packed with real
specifics pulled from the resume, not generic filler. Usually 3-5 sentences is enough, but if
their work history has many employers, use as many sentences as it takes to name every one of
them rather than dropping any for length.

Their name is ${firstName} ${lastName}${title ? `, role: ${title}` : ''}. Beyond that, pull in
whatever of the following actually appears in the resume text:
- Total years of experience, and/or years in specific positions
- EVERY employer/company named in the resume's work history - list all of them, not just the
  most recent or most notable one. If the resume names five companies, the summary should
  reflect all five.
- Named formations/basins worked (e.g. Montney, Duvernay, Cardium, Viking)
- Named rig types (e.g. Pad-Walking Rig, Super-Single Rig, Service Rig)
- Specific technical disciplines/techniques (e.g. directional drilling, SAGD, MPD, UBD, well control)
- Concrete achievements or scale (number of wells, rig-years, notable projects, safety
  record/TRIF, promotions)

Do NOT mention certifications or tickets (H2S Alive, IWCF, RigPass, etc.) even if they appear in
the resume - those are tracked separately on the consultant's profile and don't belong in this
summary.

Rules:
- Every claim must be directly supported by the resume text - never invent, infer, or round up
  a number that isn't stated.
- Every company named in the work history must be mentioned - don't drop any for length; trim
  other details instead if the sentence count is getting tight.
- Prefer concrete nouns (named formations, rig types, employers, numbers) over vague adjectives
  ("skilled", "proven track record", "excellent communicator") - only reach for a vague
  descriptor when there's genuinely nothing concrete to say instead.
- If the resume is thin on specifics, write a shorter, honest summary rather than padding it out
  with generic claims.
- Confident, professional tone. Return ONLY the summary paragraph - no preamble, no quotation
  marks, no markdown.

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