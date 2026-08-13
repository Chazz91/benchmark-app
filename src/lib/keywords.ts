import { prisma } from '@/lib/prisma';
import type { KeywordType } from '@prisma/client';

// Resolves a freeform label (e.g. from Claude's resume parsing) to an existing canonical
// Keyword row when one clearly matches (e.g. "Montney" -> "Montney (BC, AB)"), instead of
// creating a duplicate bare-label entry. Falls back to creating a new keyword if nothing matches.
export async function resolveOrCreateKeyword(label: string, type: KeywordType) {
  // 1. Exact match first (fast path, also catches labels that already include the suffix)
  const exact = await prisma.keyword.findUnique({ where: { label_type: { label, type } } });
  if (exact) return exact;

  // 2. Look for an existing keyword of the same type whose label contains this one
  //    (case-insensitive) - e.g. parsed "Montney" resolves to "Montney (BC, AB)", and parsed
  //    "SAGD" resolves to "Steam-Assisted Gravity Drainage (SAGD)"
  const candidates = await prisma.keyword.findMany({ where: { type } });
  const lowerLabel = label.trim().toLowerCase();
  const match =
    lowerLabel.length >= 3
      ? candidates.find(
          (k) => k.label.toLowerCase().includes(lowerLabel) || lowerLabel.includes(k.label.toLowerCase())
        )
      : candidates.find((k) => k.label.toLowerCase() === lowerLabel);
  if (match) return match;

  // 3. No match - create a new keyword with the label as given
  return prisma.keyword.create({ data: { label, type } });
}