export type CvPdfSegment = {
  id: string;
  page: number;
  order: number;
  text: string;
  fontSize: number;
  isHeadingCandidate: boolean;
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

type PositionedItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  hasEOL: boolean;
};

const PDF_LINE_Y_TOLERANCE = 2.8;
const PDF_COLUMN_GAP_THRESHOLD = 36;
const PDF_SPACED_LABEL_MIN_TOKENS = 4;

function normalizePdfText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\u00ad/g, "").trim();
}

function isSingleLetterToken(token: string) {
  return /^[A-Za-zÆØÅæøå]$/u.test(token);
}

function isDigitToken(token: string) {
  return /^\d+$/u.test(token);
}

function isHyphenLetterToken(token: string) {
  return /^-[A-Za-zÆØÅæøå]$/u.test(token);
}

function isLabelPunctuationToken(token: string) {
  return /^[.:,+/]$/u.test(token);
}

function shouldCollapseSpacedLabel(text: string) {
  const tokens = normalizePdfText(text).split(/\s+/).filter(Boolean);
  if (tokens.length < PDF_SPACED_LABEL_MIN_TOKENS) return false;

  const signalTokens = tokens.filter(
    (token) =>
      isSingleLetterToken(token) ||
      isDigitToken(token) ||
      isHyphenLetterToken(token) ||
      isLabelPunctuationToken(token),
  ).length;

  return signalTokens / tokens.length > 0.45;
}

function normalizeCommonLabelArtifacts(text: string) {
  return text
    .replace(/\s+([.:,+/])/g, "$1")
    .replace(/([.:/+])\s+([A-Za-zÆØÅæøå])/gu, "$1$2")
    .replace(/([.:/+])(\S)/g, "$1$2")
    .replace(/(?<=\d)\s+(?=\d)/gu, "")
    .replace(/\b([A-ZÆØÅ]{2,})\s+([A-ZÆØÅ]{1,4})\b/g, "$1$2")
    .replace(/\b([A-Za-zÆØÅæøå.]+)(Gmb)\s+H\b/g, "$1 $2H")
    .replace(/([A-ZÆØÅ]{2,})(ASA|AS|AB|BV|SA)\b/g, "$1 $2")
    .replace(/([A-Za-zÆØÅæøå.]+)(GmbH)\b/g, "$1 $2")
    .replace(/(\d)\s*\+\s*års\s*erfaring/giu, "$1+ års erfaring")
    .replace(/(\d)\s*årserfaring/giu, "$1 års erfaring")
    .replace(/([A-Za-zÆØÅæøå])-ingeniørmed\b/gu, "$1-ingeniør med")
    .replace(/\b(\d{1,2})\s*\/\s*(\d{2,4})\b/g, "$1/$2")
    .replace(/\bmed(\d)/giu, "med $1")
    .replace(/\bårs([A-Za-zÆØÅæøå])/giu, "års $1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function collapseSpacedLabelText(text: string) {
  const normalized = normalizePdfText(text);
  if (!shouldCollapseSpacedLabel(normalized)) return normalized;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const words: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      words.push(current);
      current = "";
    }
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1] || "";

    if (isLabelPunctuationToken(token)) {
      if (current) current += token;
      else words.push(token);
      continue;
    }

    if (isHyphenLetterToken(token)) {
      current += token;
      continue;
    }

    if (isDigitToken(token)) {
      if (current && !/^\d+$/u.test(current) && !/[+-]$/u.test(current)) flush();
      current += token;
      continue;
    }

    if (!isSingleLetterToken(token)) {
      flush();
      words.push(token);
      continue;
    }

    if (!current) {
      current = token;
      continue;
    }

    const currentAllUpper = /^[A-ZÆØÅ0-9.]+$/u.test(current);
    const currentEndsLower = /[a-zæøå]$/u.test(current);
    const nextIsLower = /^[a-zæøå]$/u.test(next);

    if (currentAllUpper && current.length >= 2 && /^[A-ZÆØÅ]$/u.test(token) && nextIsLower) {
      flush();
      current = token;
      continue;
    }

    if (currentEndsLower && /^[A-ZÆØÅ]$/u.test(token) && nextIsLower) {
      flush();
      current = token;
      continue;
    }

    if (currentEndsLower && /^[A-ZÆØÅ]$/u.test(token) && next) {
      flush();
      current = token;
      continue;
    }

    current += token;
  }

  flush();

  return normalizeCommonLabelArtifacts(words.join(" "));
}

function shouldInsertSpace(previous: PositionedItem, next: PositionedItem, gap: number) {
  if (previous.text.endsWith("-")) return false;
  if (/^[,.;:!?)]/.test(next.text)) return false;
  if (/[(/]$/.test(previous.text)) return false;
  return gap > 1.5;
}

function joinLineItems(items: PositionedItem[]): string {
  return items
    .sort((a, b) => a.x - b.x)
    .reduce((line, item, index, array) => {
      if (index === 0) return item.text;

      const previous = array[index - 1];
      const previousRight = previous.x + previous.width;
      const gap = item.x - previousRight;
      const separator = shouldInsertSpace(previous, item, gap) ? " " : "";
      return `${line}${separator}${item.text}`;
    }, "");
}

function splitLineIntoClusters(items: PositionedItem[]) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  const clusters: PositionedItem[][] = [];

  for (const item of ordered) {
    const currentCluster = clusters[clusters.length - 1];
    if (!currentCluster) {
      clusters.push([item]);
      continue;
    }

    const previous = currentCluster[currentCluster.length - 1];
    const previousRight = previous.x + previous.width;
    const gap = item.x - previousRight;
    const adaptiveThreshold = Math.max(PDF_COLUMN_GAP_THRESHOLD, Math.max(previous.fontSize, item.fontSize) * 2.8);

    if (gap > adaptiveThreshold) {
      clusters.push([item]);
      continue;
    }

    currentCluster.push(item);
  }

  return clusters;
}

function isHeadingCandidate(text: string, fontSize: number, averageFontSize: number) {
  if (!text) return false;
  if (text.length > 80) return false;
  if (/[.!?]$/.test(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;

  const upperRatio = text.replace(/[^A-ZÆØÅ]/g, "").length / Math.max(text.replace(/[^A-Za-zÆØÅæøå]/g, "").length, 1);
  if (upperRatio > 0.6) return true;

  if (fontSize >= averageFontSize * 1.18 && words.length <= 6) return true;

  if (/^[A-ZÆØÅ][A-Za-zÆØÅæøå/& -]+:$/.test(text)) return true;

  return false;
}

export function buildCvPdfSegments(
  items: PdfTextItem[],
  pageNumber: number,
  startingOrder = 0,
): CvPdfSegment[] {
  const positioned = items
    .map<PositionedItem | null>((item) => {
      const text = normalizePdfText(item.str || "");
      const transform = Array.isArray(item.transform) ? item.transform : [];
      if (!text || transform.length < 6) return null;

      return {
        text,
        x: Number(transform[4] || 0),
        y: Number(transform[5] || 0),
        width: Number(item.width || 0),
        fontSize: Math.abs(Number(item.height || transform[0] || 0)) || 10,
        hasEOL: Boolean(item.hasEOL),
      };
    })
    .filter((item): item is PositionedItem => Boolean(item))
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > PDF_LINE_Y_TOLERANCE) return b.y - a.y;
      return a.x - b.x;
    });

  if (positioned.length === 0) return [];

  const averageFontSize =
    positioned.reduce((sum, item) => sum + item.fontSize, 0) / positioned.length;

  const lines: PositionedItem[][] = [];

  for (const item of positioned) {
    const currentLine = lines[lines.length - 1];
    if (!currentLine) {
      lines.push([item]);
      continue;
    }

    const previousY = currentLine[0].y;
    if (Math.abs(previousY - item.y) <= PDF_LINE_Y_TOLERANCE) {
      currentLine.push(item);
      continue;
    }

    lines.push([item]);
  }

  return lines
    .flatMap((lineItems) => splitLineIntoClusters(lineItems))
    .map((clusterItems, index) => {
      const text = normalizePdfText(joinLineItems(clusterItems));
      if (!text) return null;

      const fontSize = Math.max(...clusterItems.map((item) => item.fontSize));
      const normalizedText = collapseSpacedLabelText(text);
      return {
        id: `p${pageNumber}-s${index + 1}`,
        page: pageNumber,
        order: startingOrder + index,
        text: normalizedText,
        fontSize,
        isHeadingCandidate: isHeadingCandidate(normalizedText, fontSize, averageFontSize),
      } satisfies CvPdfSegment;
    })
    .filter((segment): segment is CvPdfSegment => Boolean(segment));
}

export async function extractCvPdfSegments(file: File): Promise<{
  segments: CvPdfSegment[];
  text: string;
  isLowTextConfidence: boolean;
}> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const segments: CvPdfSegment[] = [];
  let order = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageSegments = buildCvPdfSegments(content.items as PdfTextItem[], pageNumber, order);
    segments.push(...pageSegments);
    order += pageSegments.length;
  }

  const text = segments.map((segment) => segment.text).join("\n");
  const isLowTextConfidence = segments.length < 12 || text.replace(/\s+/g, "").length < 500;

  return {
    segments,
    text,
    isLowTextConfidence,
  };
}
