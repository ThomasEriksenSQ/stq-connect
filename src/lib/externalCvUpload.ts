import mammoth from "mammoth";

import { supabase } from "@/integrations/supabase/client";
import { extractCvPdfSegments } from "@/lib/cvPdfExtract";
import { extractTechnologyTagsFromText, normalizeTechnologyTags } from "@/lib/technologyTags";

const MAX_EXTERNAL_CV_SIZE_BYTES = 10 * 1024 * 1024;

export const EXTERNAL_CV_ACCEPT = ".pdf,.docx,.txt,.rtf";
export const EXTERNAL_CV_SUPPORTED_LABEL = "PDF, DOCX, TXT eller RTF";

type ExternalCvExtension = "pdf" | "docx" | "txt" | "rtf";

export interface ExternalCvUploadAnalysis {
  email: string | null;
  fileName: string;
  name: string;
  phone: string | null;
  rawText: string | null;
  technologies: string[];
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_REGEX = /(?:(?:\+|00)\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,16}\d/g;
const NAME_FILE_STOPWORDS = new Set(["cv", "resume", "profil", "profile", "consultant", "konsulent", "word"]);
const NAME_LINE_BLACKLIST = [
  /^curriculum vitae$/i,
  /^resume$/i,
  /^cv$/i,
  /^profil$/i,
  /^profile$/i,
  /^contact$/i,
  /^kontakt$/i,
];

function getExternalCvExtension(file: File): ExternalCvExtension | null {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "pdf";
  if (lowerName.endsWith(".docx")) return "docx";
  if (lowerName.endsWith(".txt")) return "txt";
  if (lowerName.endsWith(".rtf")) return "rtf";
  return null;
}

function ensureSupportedExternalCv(file: File) {
  const extension = getExternalCvExtension(file);
  if (!extension) {
    throw new Error(`Støtter kun ${EXTERNAL_CV_SUPPORTED_LABEL}`);
  }
  if (file.size > MAX_EXTERNAL_CV_SIZE_BYTES) {
    throw new Error("Filen er for stor (maks 10 MB)");
  }
  return extension;
}

async function readFileAsBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("Kunne ikke lese filen"));
    reader.readAsDataURL(file);
  });
}

function stripRtfToText(input: string) {
  return input
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractTextFromExternalCv(file: File, extension: ExternalCvExtension) {
  if (extension === "pdf") {
    const { text } = await extractCvPdfSegments(file);
    return text.trim() || null;
  }

  if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim() || null;
  }

  const rawText = await file.text();
  if (extension === "rtf") return stripRtfToText(rawText) || null;
  return rawText.trim() || null;
}

function extractEmailFromText(rawText: string | null) {
  if (!rawText) return null;
  return rawText.match(EMAIL_REGEX)?.[0]?.trim() || null;
}

function normalizePhoneCandidate(rawValue: string) {
  const trimmed = rawValue.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2).trim()}`;
  return trimmed;
}

function extractPhoneFromText(rawText: string | null) {
  if (!rawText) return null;
  const candidates = rawText.match(PHONE_REGEX) || [];
  for (const candidate of candidates) {
    const normalized = normalizePhoneCandidate(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function toDisplayName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-ZÆØÅ][A-ZÆØÅ'`-]*$/u.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function extractNameFromFilename(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const tokens = base
    .split(/[_\-. ]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !NAME_FILE_STOPWORDS.has(token.toLowerCase()))
    .filter((token) => /^[\p{L}][\p{L}'`-]*$/u.test(token));

  if (tokens.length < 2 || tokens.length > 4) return "";
  return toDisplayName(tokens.join(" "));
}

function looksLikeNameLine(line: string) {
  const cleaned = line.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length < 4 || cleaned.length > 60) return false;
  if (NAME_LINE_BLACKLIST.some((pattern) => pattern.test(cleaned))) return false;
  if (cleaned.includes("@")) return false;
  if (/\d/.test(cleaned)) return false;
  if (/[:/|]/.test(cleaned)) return false;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((word) => /^[\p{Lu}][\p{L}'`-]*$/u.test(word));
}

function extractNameFromText(rawText: string | null, fileName: string) {
  if (rawText) {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20);

    const matchedLine = lines.find(looksLikeNameLine);
    if (matchedLine) return matchedLine;
  }

  return extractNameFromFilename(fileName);
}

function buildLocalFallbackAnalysis(rawText: string | null, fileName: string) {
  return {
    email: extractEmailFromText(rawText),
    name: extractNameFromText(rawText, fileName),
    phone: extractPhoneFromText(rawText),
    technologies: (rawText ? extractTechnologyTagsFromText(rawText) : []).slice(0, 12),
  };
}

export async function analyzeExternalCvUpload(file: File): Promise<ExternalCvUploadAnalysis> {
  const extension = ensureSupportedExternalCv(file);
  const rawText = await extractTextFromExternalCv(file, extension);
  const localFallback = buildLocalFallbackAnalysis(rawText, file.name);

  if (extension !== "pdf" && !rawText) {
    throw new Error("Fant ingen tekst i dokumentet");
  }

  const body: Record<string, unknown> = {
    filename: file.name,
  };

  if (extension === "pdf") {
    body.base64 = await readFileAsBase64(file);
  }

  if (rawText) {
    body.text = rawText.slice(0, 40000);
  }

  try {
    const { data, error } = await supabase.functions.invoke("extract-cv-contact", {
      body,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return {
      email: data?.email || localFallback.email || null,
      fileName: file.name,
      name: data?.name || localFallback.name || "",
      phone: data?.phone || localFallback.phone || null,
      rawText: rawText || null,
      technologies: normalizeTechnologyTags(
        Array.isArray(data?.technologies) && data.technologies.length > 0
          ? data.technologies
          : localFallback.technologies,
      ).slice(0, 12),
    };
  } catch (error) {
    console.warn("extract-cv-contact failed, using local fallback", error);

    if (!rawText) {
      throw error;
    }

    return {
      email: localFallback.email,
      fileName: file.name,
      name: localFallback.name,
      phone: localFallback.phone,
      rawText,
      technologies: localFallback.technologies,
    };
  }
}
