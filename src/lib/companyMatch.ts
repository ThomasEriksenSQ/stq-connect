export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(as|asa|ab|gmbh|ltd|inc|llc|norway|norge|no)\b/g, '')
    .replace(/[.\-_,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function companiesMatch(a: string, b: string): boolean {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  return false;
}
