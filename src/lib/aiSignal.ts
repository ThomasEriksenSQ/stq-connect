/**
 * Shared AI signal analysis utility.
 * Calls the existing chat edge function to get a signal recommendation.
 */

export interface AiSignalResult {
  anbefalt_signal: string;
  begrunnelse: string;
  konfidens: "høy" | "middels" | "lav";
}

const SYSTEM_PROMPT = `Du er CRM-assistent for STACQ, et norsk IT-konsulentbyrå. Analyser aktivitetshistorikken og anbefal riktig salgssignal.
Bruk alltid "konsulent" — aldri "rådgiver", "ekspert" eller "spesialist".
Svar KUN med JSON:
{
  "anbefalt_signal": "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt",
  "begrunnelse": "maks 15 ord, norsk",
  "konfidens": "høy" | "middels" | "lav"
}
Returner BARE JSON, ingen annen tekst.`;

export async function analyzeSignal(input: {
  currentSignal: string | null;
  activities: Array<{ type: string; subject: string; created_at: string }>;
  lastTaskDueDate: string | null;
  contactName: string;
}): Promise<AiSignalResult | null> {
  const activityText = input.activities
    .slice(0, 5)
    .map((a) => `- ${a.created_at.slice(0, 10)}: [${a.type}] ${a.subject}`)
    .join("\n");

  const userContent = `Kontakt: ${input.contactName}
Nåværende signal: ${input.currentSignal || "ingen"}
Aktiviteter:
${activityText || "(ingen aktiviteter)"}
Siste oppfølging: ${input.lastTaskDueDate || "ingen"}`;

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
    return JSON.parse(text) as AiSignalResult;
  } catch {
    return null;
  }
}
