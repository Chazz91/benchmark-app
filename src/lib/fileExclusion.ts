// Any filename containing one of these is skipped entirely - never uploaded, never sent to
// Claude for reading, never touched at all. This is a safety net in case banking, tax, or
// other sensitive company documents happen to be mixed into a resume/certification folder.
const EXCLUDED_NAME_HINTS = [
  'void', 'cheque', 'check', 'bank', 'banking', 'direct deposit', 'deposit',
  'invoice', 'tax', 'sin', 'social insurance', 'insurance number', 't4', 't4a',
  'payroll', 'wage', 'salary', 'confidential', 'contract', 'agreement', 'nda',
];

export function isExcludedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (EXCLUDED_NAME_HINTS.some((hint) => lower.includes(hint))) return true;

  // System/junk/temp files that are never real documents, no matter what they're named -
  // e.g. "~$Resume.docx" is a Microsoft Word lock file, not the actual resume.
  const baseName = fileName.split('/').pop() || fileName;
  if (baseName.startsWith('~$')) return true;
  if (baseName.startsWith('.')) return true;
  if (/^thumbs\.db$/i.test(baseName)) return true;
  if (/^desktop\.ini$/i.test(baseName)) return true;

  return false;
}