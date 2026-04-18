export interface NormalizedOutlookMailItem {
  id: string;
  subject: string;
  receivedAt: string | null;
  from: string;
  fromName: string;
  to: string;
  preview: string;
  bodyText: string;
  isRead: boolean;
}

export function coerceDisplayText(value: unknown, depth = 0): string {
  if (depth > 3 || value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceDisplayText(entry, depth + 1))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of [
      "emailAddress",
      "name",
      "displayName",
      "label",
      "address",
      "email",
      "subject",
      "preview",
      "text",
      "content",
      "body",
      "value",
    ]) {
      const text = coerceDisplayText(record[key], depth + 1);
      if (text) return text;
    }
  }

  return "";
}

export function normalizeOutlookMailItems(payload: unknown): NormalizedOutlookMailItem[] {
  if (!Array.isArray(payload)) return [];

  return payload.map((entry, index) => {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const id = coerceDisplayText(record.id) || `outlook-${index}`;
    const receivedAt = coerceDisplayText(record.received_at ?? record.date ?? record.created_at) || null;

    return {
      id,
      subject: coerceDisplayText(record.subject) || "Uten emne",
      receivedAt,
      from: coerceDisplayText(record.from),
      fromName: coerceDisplayText(record.from_name ?? record.fromName),
      to: coerceDisplayText(record.to ?? record.toRecipients),
      preview: coerceDisplayText(record.preview ?? record.bodyPreview),
      bodyText: coerceDisplayText(record.body_text ?? record.bodyText ?? record.body),
      isRead: Boolean(record.is_read ?? record.isRead),
    };
  });
}
