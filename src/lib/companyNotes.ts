const IMPORT_HEADER_PATTERNS = [
  /^\s*\[?\s*must[-\s]*have\s*\]?\s*$/i,
  /^\s*kilde\s*:?\s*linkedin[-\s]*import\s*$/i,
  /^\s*nace(?:\s*:|\s+\d).*/i,
];

export function hasCompanyImportNoteHeaders(value: unknown): boolean {
  if (value == null) return false;

  return String(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .some((line) => IMPORT_HEADER_PATTERNS.some((pattern) => pattern.test(line)));
}

export function cleanCompanyImportNoteHeaders(value: unknown): string {
  if (value == null) return "";

  return String(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !IMPORT_HEADER_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
