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

function normalizePdfText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\u00ad/g, "").trim();
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
      return {
        id: `p${pageNumber}-s${index + 1}`,
        page: pageNumber,
        order: startingOrder + index,
        text,
        fontSize,
        isHeadingCandidate: isHeadingCandidate(text, fontSize, averageFontSize),
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
