import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DetectedTicket {
  label: string; // certification name as read/matched
  matchedTicketTypeId?: string; // resolved against the existing TicketType list, if found
  matchedTicketTypeLabel?: string;
  issueDate?: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD
  confidence: number;
}

interface RawDetectedTicket {
  label: string;
  issueDate: string | null;
  expiryDate: string | null;
  confidence: number;
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function parseTicketDocument(buffer: Buffer, mimeType: string): Promise<DetectedTicket[]> {
  const ticketTypes = await prisma.ticketType.findMany({ select: { label: true } });
  const knownLabels = ticketTypes.map((t) => t.label);

  const prompt = `You are reading a photo or scan of one or more oil & gas safety certification cards/documents ("tickets") for a consultant's profile.

Known certification names already in our system (match to one of these when it's clearly the same certification, even if the wording, abbreviation, or formatting on the card differs slightly): ${knownLabels.join(', ')}

The image may show a single certification card, or MULTIPLE cards laid out together (e.g. spread out on a table, or several photographed side by side). Detect EACH separate certification visible in the image — do not merge them into one.

Return ONLY a JSON array (no markdown fences, no preamble), one object per certification detected:
[
  {
    "label": string,           // the certification name, matched to the known list above when it's clearly the same one, otherwise your best direct reading of the card
    "issueDate": string|null,  // YYYY-MM-DD, the date the certification was issued/completed/passed
    "expiryDate": string|null, // YYYY-MM-DD, the date the certification expires
    "confidence": number       // 0-1, how confident you are in this overall reading (dates + name)
  }
]

Rules:
- If a card only shows one date clearly (e.g. just an expiry date, or just an issue date), leave the other field null rather than guessing or calculating it.
- If a certification's name doesn't clearly match anything in the known list, still include it using your best direct reading — a person will review and confirm it before it's saved.
- Do not invent cards or dates that are not actually visible in the image.
- If the image is unclear, blurry, or you cannot confidently read a field, lower the confidence score rather than guessing.`;

  const contentBlock = SUPPORTED_IMAGE_TYPES.includes(mimeType)
    ? { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as any, data: buffer.toString('base64') } }
    : { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: buffer.toString('base64') } };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [contentBlock, { type: 'text', text: prompt }],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No response from ticket document parser');
  }

  const rawText = textBlock.text.trim();

  // Claude sometimes adds a short explanatory sentence before the JSON (despite being asked
  // not to) for documents that are less clearly a "certification card" - like an insurance
  // certificate or a company registration form. Pull out just the JSON array itself rather
  // than assuming the whole response is clean JSON.
  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  const cleaned = (arrayMatch ? arrayMatch[0] : rawText).replace(/```json|```/g, '').trim();

  let detected: RawDetectedTicket[];
  try {
    detected = JSON.parse(cleaned);
  } catch (err) {
    // If we truly can't find any structured data, treat it as "nothing detected" rather than
    // a hard failure - this is expected for documents that aren't actually certification cards.
    return [];
  }

  if (!Array.isArray(detected)) return [];

  // Try to match each detected label to an existing TicketType (exact, then fuzzy) without creating new ones -
  // ticket types are a curated admin-managed list, so an unmatched one is left for the consultant to pick manually.
  const allTicketTypes = await prisma.ticketType.findMany();
  const results: DetectedTicket[] = detected.map((d) => {
    const lowerLabel = d.label.trim().toLowerCase();
    const matched =
      allTicketTypes.find((t) => t.label.toLowerCase() === lowerLabel) ||
      allTicketTypes.find(
        (t) => t.label.toLowerCase().includes(lowerLabel) || lowerLabel.includes(t.label.toLowerCase())
      );

    return {
      label: d.label,
      matchedTicketTypeId: matched?.id,
      matchedTicketTypeLabel: matched?.label,
      issueDate: d.issueDate || undefined,
      expiryDate: d.expiryDate || undefined,
      confidence: d.confidence,
    };
  });

  return results;
}