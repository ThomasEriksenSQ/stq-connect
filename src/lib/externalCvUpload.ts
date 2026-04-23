import mammoth from "mammoth";

import { supabase } from "@/integrations/supabase/client";
import { extractCvPdfSegments } from "@/lib/cvPdfExtract";
import { normalizeTechnologyTags } from "@/lib/technologyTags";

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

export async function analyzeExternalCvUpload(file: File): Promise<ExternalCvUploadAnalysis> {
  const extension = ensureSupportedExternalCv(file);
  const rawText = await extractTextFromExternalCv(file, extension);

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

  const { data, error } = await supabase.functions.invoke("extract-cv-contact", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return {
    email: data?.email || null,
    fileName: file.name,
    name: data?.name || "",
    phone: data?.phone || null,
    rawText: rawText || null,
    technologies: normalizeTechnologyTags(data?.technologies || []),
  };
}
