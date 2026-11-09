// A resume uploaded straight from outside the app - e.g. one of our own already-formatted
// resumes pulled off the company's shared drive, rather than a consultant's original - is
// detected by its file name. Our own generator always names its output "<Name> - Benchmark
// Resume.pdf/.docx", and anything uploaded by hand following that same naming convention
// should be treated the same way: hidden from the consultant themselves, same as a resume
// the app generated directly (see isFormatted on the Resume model).
export function looksLikeBenchmarkFormat(fileName: string | null | undefined): boolean {
  if (!fileName) return false;
  return /benchmark/i.test(fileName);
}
