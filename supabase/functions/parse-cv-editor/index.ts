import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  buildCvEditorImportDocument,
  type CvEditorImportSegment,
} from "../_shared/cvEditorImport.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "google/gemini-2.5-flash";

type ParseCvEditorRequest = {
  base64?: string;
  filename?: string;
  segments?: CvEditorImportSegment[];
  isLowTextConfidence?: boolean;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAuthorizedClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return supabase;
}

function extractJsonPayload(text: string) {
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }

  clean = clean.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(clean);
}

function buildSegmentCatalog(segments: CvEditorImportSegment[]) {
  return segments
    .map((segment) => {
      const flags = [segment.isHeadingCandidate ? "heading" : null, `page=${segment.page}`].filter(Boolean);
      return `[${segment.id}] (${flags.join(", ")}) ${segment.text}`;
    })
    .join("\n");
}

function detectStacqTemplate(segments: CvEditorImportSegment[]) {
  const firstPageText = segments
    .filter((segment) => segment.page === 1)
    .map((segment) => segment.text.toLocaleUpperCase("nb-NO"))
    .join("\n");

  return (
    firstPageText.includes("PERSONALIA") &&
    firstPageText.includes("NØKKELPUNKTER") &&
    firstPageText.includes("UTDANNELSE")
  );
}

function buildTemplateHint(templateDetected: boolean) {
  if (!templateDetected) return "";

  return `Dokumentet ser ut til å bruke STACQ sin CV-mal:
- venstre sorte kolonne inneholder sidebarSections
- kontaktblokken øverst til høyre skal IKKE bli en sidebarSection
- navnefelt og tittel i toppraden skal til navn/tittel
- brødteksten i hovedkolonnen skal til introParagraphs, competenceGroups og prosjekter`;
}

function hasMeaningfulImportedContent(document: ReturnType<typeof buildCvEditorImportDocument>) {
  return Boolean(
    document.navn ||
      document.tittel ||
      document.sidebarSections.length ||
      document.introParagraphs.length ||
      document.competenceGroups.length ||
      document.projects.length ||
      document.education.length ||
      document.workExperience.length ||
      document.additionalSections.length,
  );
}

async function invokeLovableChat(payload: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  base64?: string;
}) {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: payload.userPrompt }];

  if (payload.base64) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:application/pdf;base64,${payload.base64}`,
      },
    });
  }

  const response = await fetch(LOVABLE_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      max_tokens: 16000,
      messages: [
        { role: "system", content: payload.systemPrompt },
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("parse-cv-editor AI gateway error:", response.status, errorText);

    if (response.status === 429) {
      throw new Response(JSON.stringify({ error: "For mange forespørsler, prøv igjen om litt." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status === 402) {
      throw new Response(JSON.stringify({ error: "Kreditter oppbrukt. Legg til kreditter i Lovable." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("AI-analyse feilet");
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("AI returnerte tomt svar");
  }

  return extractJsonPayload(text);
}

async function parseFromSegments(args: {
  apiKey: string;
  filename: string;
  segments: CvEditorImportSegment[];
  templateDetected?: boolean;
}) {
  const systemPrompt = `Du er en CV-importør for STACQ sin CV-editor.
Målet er å bevare originaltekst fra CV-en så ordrett som mulig.

Regler:
- IKKE skriv om, forbedre eller oppsummer tekst.
- Bruk KUN segment-id-er for brødtekst, punktlister og mest mulig av øvrig innhold.
- Når et felt består av flere linjer fra PDF-en, returner en array med segment-id-er i riktig rekkefølge.
- Ikke finn på nye segment-id-er.
- Ikke dupliser samme segment i flere felter med mindre CV-en faktisk gjentar teksten.
- sidebarSections kan KUN inneholde seksjonene PERSONALIA, NØKKELPUNKTER og UTDANNELSE.
- Seksjoner som PROGRAMMERINGSSPRÅK, SOFTWARE, HARDWARE, OPERATIVSYSTEMER, SERTIFISERINGER, KURS, FOREDRAG og ANNET RELEVANT skal IKKE i sidebarSections.
- education og workExperience skal bare brukes for faktiske hovedseksjoner/tidslinjer i hovedkolonnen, ikke for punktlisten i sidebar under UTDANNELSE.
- additionalSections skal brukes for ekstra hovedseksjoner som ikke hører hjemme i intro, kompetanse, prosjekter, utdanning, arbeidserfaring eller sidebar.
- additionalSections.title skal være en kort seksjonstittel hentet fra CV-en, helst selve overskriften.
- project.role skal kun være selve rollen/tittelen, uten prefiks som "Rolle:".
- project.period skal kun være perioden/datoen, uten prefiks som "Periode:".
- project.company, project.subtitle, project.role og project.period skal være korte labels, ikke bokstavspacet tekst.
- Hvis en seksjon ikke finnes, returner tom array.
- Returner KUN gyldig JSON.

Returner eksakt denne strukturen:
{
  "navnIds": ["string"],
  "tittelIds": ["string"],
  "sidebarSections": [
    { "heading": "string", "headingIds": ["string"], "itemIds": ["string"], "items": ["string"] }
  ],
  "introParagraphs": [["string"]],
  "competenceGroups": [
    { "label": "string", "itemIds": ["string"] }
  ],
  "projects": [
    {
      "companyIds": ["string"],
      "subtitleIds": ["string"],
      "roleIds": ["string"],
      "periodIds": ["string"],
      "paragraphs": [["string"]],
      "technologyIds": ["string"]
    }
  ],
  "education": [
    { "periodIds": ["string"], "primaryIds": ["string"], "secondaryIds": ["string"] }
  ],
  "workExperience": [
    { "periodIds": ["string"], "primaryIds": ["string"] }
  ],
  "additionalSections": [
    {
      "title": "string",
      "titleIds": ["string"],
      "format": "timeline|bullet",
      "items": [
        { "periodIds": ["string"], "primaryIds": ["string"] }
      ]
    }
  ],
  "warnings": ["string"]
}`;

  const templateHint = buildTemplateHint(Boolean(args.templateDetected));

  const userPrompt = `Analyser CV-en "${args.filename}" og bygg en teksttro editor-struktur fra segmentene under.

${templateHint}

Segmenter:
${buildSegmentCatalog(args.segments)}`;

  const parsed = await invokeLovableChat({
    apiKey: args.apiKey,
    systemPrompt,
    userPrompt,
  });

  return buildCvEditorImportDocument(parsed, args.segments);
}

async function parseFromOcr(args: {
  apiKey: string;
  filename: string;
  base64: string;
  segments: CvEditorImportSegment[];
  templateDetected?: boolean;
}) {
  const systemPrompt = `Du er en CV-importør for STACQ sin CV-editor.
Denne PDF-en ser ut til å være scannet eller tekstfattig. Du må derfor transkribere og strukturere innholdet så teksttro som mulig.

Regler:
- Bevar original ordlyd så langt det lar seg gjøre.
- Ikke skriv en ny profesjonell oppsummering.
- Ikke forbedre språk eller tone.
- Det er lov å normalisere åpenbare whitespace-feil og datoformat hvis nødvendig.
- Ikke legg kontaktblokken inn i sidebarSections.
- Ikke legg navn eller tittel inn i introParagraphs.
- Ikke legg sidebar-punkter inn i introParagraphs.
- sidebarSections kan KUN inneholde PERSONALIA, NØKKELPUNKTER og UTDANNELSE.
- Ikke legg PROGRAMMERINGSSPRÅK, SOFTWARE, HARDWARE, OPERATIVSYSTEMER, SERTIFISERINGER, KURS, FOREDRAG eller ANNET RELEVANT i sidebarSections.
- education og workExperience skal bare brukes for faktiske hovedseksjoner/tidslinjer i hovedkolonnen, ikke for punktlisten i sidebar under UTDANNELSE.
- Sidebar-punkter skal være korte punktlinjer, ikke lange setninger.
- Ikke dupliser "Rolle", "Periode" eller "Teknologier" både i overskrift og brødtekst.
- project.role skal kun være selve rollen/tittelen, uten "Rolle:".
- project.period skal kun være perioden/datoen, uten "Periode:".
- project.company, project.subtitle, project.role og project.period skal ikke være bokstavspacet tekst.
- additionalSections skal brukes for ekstra hovedseksjoner som sertifiseringer, kurs, foredrag, konferanser og lignende.
- Returner KUN gyldig JSON.

Returner eksakt denne strukturen:
{
  "navn": "string",
  "tittel": "string",
  "sidebarSections": [
    { "heading": "string", "items": ["string"] }
  ],
  "introParagraphs": ["string"],
  "competenceGroups": [
    { "label": "string", "content": "string" }
  ],
  "projects": [
    {
      "company": "string",
      "subtitle": "string",
      "role": "string",
      "period": "string",
      "paragraphs": ["string"],
      "technologies": "string"
    }
  ],
  "education": [
    { "period": "string", "primary": "string", "secondary": "string" }
  ],
  "workExperience": [
    { "period": "string", "primary": "string" }
  ],
  "additionalSections": [
    {
      "title": "string",
      "format": "timeline|bullet",
      "items": [
        { "period": "string", "primary": "string" }
      ]
    }
  ],
  "warnings": ["string"]
}`;

  const templateHint = buildTemplateHint(Boolean(args.templateDetected));

  const userPrompt = `Analyser CV-en "${args.filename}" med OCR-lignende nøyaktighet. Hvis de vedlagte tekstsegmentene hjelper, bruk dem som støtte, men det viktigste er å transkribere teksten så trofast som mulig.

${templateHint}

Eksisterende segmenter:
${args.segments.length ? buildSegmentCatalog(args.segments) : "(ingen brukbare tekstsegmenter funnet)"}`;

  const parsed = await invokeLovableChat({
    apiKey: args.apiKey,
    systemPrompt,
    userPrompt,
    base64: args.base64,
  });

  return buildCvEditorImportDocument(parsed, args.segments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuthorizedClient(req);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const body = (await req.json()) as ParseCvEditorRequest;
    const filename = body.filename || "cv.pdf";
    const segments = Array.isArray(body.segments) ? body.segments : [];
    const isLowTextConfidence = Boolean(body.isLowTextConfidence);
    const templateDetected = detectStacqTemplate(segments);

    if (!segments.length && !body.base64) {
      throw new Error("Missing CV content");
    }

    let sourceMode: "segments" | "ocr" = segments.length > 0 && !isLowTextConfidence ? "segments" : "ocr";
    let requiresReview = sourceMode === "ocr";
    let importDocument;

    try {
      if (sourceMode === "segments") {
        importDocument = await parseFromSegments({
          apiKey,
          filename,
          segments,
          templateDetected,
        });
      } else if (body.base64) {
        importDocument = await parseFromOcr({
          apiKey,
          filename,
          base64: body.base64,
          segments,
          templateDetected,
        });
      } else {
        throw new Error("Missing PDF data for OCR fallback");
      }
    } catch (error) {
      if (!body.base64 || sourceMode === "ocr") {
        throw error;
      }

      console.warn("parse-cv-editor segments mode failed, falling back to OCR:", error);
      sourceMode = "ocr";
      requiresReview = true;
      importDocument = await parseFromOcr({
        apiKey,
        filename,
        base64: body.base64,
        segments,
        templateDetected,
      });
      importDocument.warnings = [
        "Automatisk fallback til OCR-løype ble brukt. Kontroller teksten ekstra nøye.",
        ...importDocument.warnings,
      ];
    }

    if (!hasMeaningfulImportedContent(importDocument)) {
      return jsonResponse({ error: "Kunne ikke hente ut nok CV-innhold. Prøv en annen PDF eller fyll inn manuelt." }, 422);
    }

    if (isLowTextConfidence && !importDocument.warnings.includes("PDF-en ser ut til å være scannet eller tekstfattig. Kontroller importen nøye.")) {
      importDocument.warnings.unshift("PDF-en ser ut til å være scannet eller tekstfattig. Kontroller importen nøye.");
    }
    if (
      templateDetected &&
      sourceMode === "ocr" &&
      !importDocument.warnings.includes("STACQ-malen ble tolket via layout-aware OCR. Kontroller spesielt navn, ingress og sidebar.")
    ) {
      importDocument.warnings.unshift("STACQ-malen ble tolket via layout-aware OCR. Kontroller spesielt navn, ingress og sidebar.");
    }

    return jsonResponse({
      ...importDocument,
      sourceMode,
      requiresReview,
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("parse-cv-editor error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
