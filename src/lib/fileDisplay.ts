// Mirrors the extension check in src/lib/storage.ts's getResumeSignedUrl - files in this list
// get served as "inline" and open fine in a new tab on every device. Everything else (Word
// docs especially) gets served as "attachment", and on mobile Safari a forced download opened
// via target="_blank" just shows a blank tab with no progress or completion indicator - the
// file downloads silently in the background, which looks broken even though it isn't. Opening
// those in the same tab instead lets the browser's normal download UI take over properly.
const INLINE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']);

export function opensInlineInBrowser(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return INLINE_EXTENSIONS.has(extension);
}
