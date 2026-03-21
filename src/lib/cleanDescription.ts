const NOISE_MARKERS = [
  "____",
  "Microsoft Teams",
  "Bli med i møtet",
  "Join the meeting",
  "Møte-ID:",
  "Meeting ID:",
  "https://teams.microsoft.com",
];

const EMAIL_HEADER_RE = /^(To|From|BCC|CC|Attachment|Subject|Body|Sent|Sendt|Fra):\s/m;
const URL_RE = /https?:\/\/[^\s)>\]]+/g;

export function cleanDescription(rawText: string | null | undefined): string | null {
  if (!rawText) return null;

  let cleaned = rawText
    .replace(/\[someday\]/g, "")
    .replace(/\[Følg opp på sikt\]/g, "")
    .trim();

  for (const marker of NOISE_MARKERS) {
    const idx = cleaned.indexOf(marker);
    if (idx !== -1) cleaned = cleaned.substring(0, idx);
  }

  if (EMAIL_HEADER_RE.test(cleaned)) {
    const bodyIdx = cleaned.indexOf("Body:");
    if (bodyIdx !== -1) {
      cleaned = cleaned.substring(bodyIdx + 5);
    } else {
      const lines = cleaned.split("\n");
      cleaned = lines.filter(
        (l) => !(/^(To|From|BCC|CC|Attachment|Subject|Sent|Sendt|Fra):\s/.test(l.trim()))
      ).join("\n");
    }
  }

  cleaned = cleaned.replace(URL_RE, "").replace(/\s+/g, " ").trim();

  if (cleaned.length < 3) return null;
  return cleaned;
}
