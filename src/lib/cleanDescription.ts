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

export function cleanDescription(text: string | null | undefined): string | null {
  if (!text) return null;

  text = text.replace(/\[someday\]/g, "").trim();
  let cleaned = text;

  // Cut at Teams / noise markers
  for (const marker of NOISE_MARKERS) {
    const idx = cleaned.indexOf(marker);
    if (idx !== -1) {
      cleaned = cleaned.substring(0, idx);
    }
  }

  // If it starts with email headers, try to extract body content
  if (EMAIL_HEADER_RE.test(cleaned)) {
    // Look for "Body:" marker
    const bodyIdx = cleaned.indexOf("Body:");
    if (bodyIdx !== -1) {
      cleaned = cleaned.substring(bodyIdx + 5);
    } else {
      // If entire text is email headers, discard
      const lines = cleaned.split("\n");
      const nonHeaderLines = lines.filter(
        (l) => !(/^(To|From|BCC|CC|Attachment|Subject|Sent|Sendt|Fra):\s/.test(l.trim()))
      );
      cleaned = nonHeaderLines.join("\n");
    }
  }

  // Remove URLs
  cleaned = cleaned.replace(URL_RE, "");

  // Clean whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.length < 3) return null;
  return cleaned;
}
