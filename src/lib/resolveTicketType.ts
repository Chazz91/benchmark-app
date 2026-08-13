import { prisma } from '@/lib/prisma';

// Ticket types are a curated, admin-managed list (unlike keywords, which grow freely) - so
// this only ever matches against what already exists. If nothing matches, the caller should
// flag it for manual review rather than silently creating a new ticket type from a filename.
export async function resolveTicketType(label: string) {
  const lowerLabel = label.trim().toLowerCase();
  if (!lowerLabel) return null;

  const all = await prisma.ticketType.findMany();

  // Exact match first
  const exact = all.find((t) => t.label.toLowerCase() === lowerLabel);
  if (exact) return exact;

  // Fuzzy: either name contains the other (handles abbreviations and partial filenames,
  // e.g. "H2S" matching "H2S Alive", or "drivers license" matching "Class 5 Driver's License")
  if (lowerLabel.length >= 3) {
    return (
      all.find(
        (t) => t.label.toLowerCase().includes(lowerLabel) || lowerLabel.includes(t.label.toLowerCase())
      ) || null
    );
  }

  return null;
}