/**
 * Shared AI signal analysis utility.
 * Calls the existing chat edge function to get a signal recommendation.
 * Combines both activity history and email data for a unified analysis.
 */

export interface AiSignalResult {
  anbefalt_signal: string;
  begrunnelse: string;
  konfidens: "høy" | "middels" | "lav";
  teknologier_funnet: string[];
  tidsramme: string | null;
}

const SYSTEM_PROMPT = `Du er CRM-assistent for STACQ, et norsk IT-konsulentbyrå som leverer embedded/firmware/C/C++-konsulenter.
Bruk alltid "konsulent" — aldri "rådgiver", "ekspert" eller "spesialist".
Analyser aktivitetshistorikken og e-poster (om tilgjengelig) og anbefal riktig salgssignal.
Identifiser også:
1. Teknologier/rammeverk nevnt i aktiviteter eller e-poster
2. Eventuell tidsramme for behov

Svar KUN med JSON:
{
  "anbefalt_signal": "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt",
  "begrunnelse": "maks 20 ord, norsk, referer til konkret innhold",
  "konfidens": "høy" | "middels" | "lav",
  "teknologier_funnet": ["C++", "RTOS"],
  "tidsramme": "Q3 2026" | null
}
Returner BARE JSON, ingen annen tekst.`;

export async function analyzeSignal(input: {
  currentSignal: string | null;
  activities: Array<{ type: string; subject: string; created_at: string }>;
  lastTaskDueDate: string | null;
  contactName: string;
  emails?: Array<{ subject: string; body_text: string; received_at: string }>;
  currentTechnologies?: string[];
}): Promise<AiSignalResult | null> {
  const activityText = input.activities
    .slice(0, 5)
    .map((a) => `- ${a.created_at.slice(0, 10)}: [${a.type}] ${a.subject}`)
    .join("\n");

  const emailText = (input.emails || [])
    .slice(0, 5)
    .map((e) => {
      const body = (e.body_text || "").slice(0, 500);
      return `[${e.received_at?.slice(0, 10)}] Emne: ${e.subject}\n${body}`;
    })
    .join("\n---\n");

  const techList = (input.currentTechnologies || []).join(", ");

  const userContent = `Kontakt: ${input.contactName}
Nåværende signal: ${input.currentSignal || "ingen"}
Eksisterende teknologier: ${techList || "(ingen)"}
Siste oppfølging: ${input.lastTaskDueDate || "ingen"}

Aktiviteter:
${activityText || "(ingen aktiviteter)"}

E-poster:
${emailText || "(ingen e-poster)"}`;

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      }
    );

    if (!resp.ok) return null;
    const data = await resp.json();
    const text = (data.text || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text);
    return {
      anbefalt_signal: parsed.anbefalt_signal,
      begrunnelse: parsed.begrunnelse,
      konfidens: parsed.konfidens,
      teknologier_funnet: parsed.teknologier_funnet || [],
      tidsramme: parsed.tidsramme || null,
    } as AiSignalResult;
  } catch {
    return null;
  }
}
