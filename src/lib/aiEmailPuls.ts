/**
 * AI E-post-puls: Analyser e-poster for salgssignaler og teknologier.
 * Gjenbruker /functions/v1/chat edge-funksjonen.
 */

export interface EmailPulsResult {
  anbefalt_signal: string;
  begrunnelse: string;
  konfidens: "høy" | "middels" | "lav";
  teknologier_funnet: string[];
  tidsramme: string | null;
}

const SYSTEM_PROMPT = `Du er CRM-assistent for STACQ, et norsk IT-konsulentbyrå som leverer embedded/firmware/C/C++-konsulenter.
Bruk alltid "konsulent" — aldri "rådgiver", "ekspert" eller "spesialist".
Analyser e-postene mellom STACQ og kontakten. Identifiser:
1. Salgssignal: Er det tegn til behov for konsulenter?
2. Teknologier: Hvilke teknologier/rammeverk nevnes?
3. Tidsramme: Nevnes det når et eventuelt behov oppstår?

Svar KUN med JSON:
{
  "anbefalt_signal": "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt",
  "begrunnelse": "maks 20 ord, norsk, referer til konkret e-postinnhold",
  "konfidens": "høy" | "middels" | "lav",
  "teknologier_funnet": ["C++", "RTOS"],
  "tidsramme": "Q3 2026" | null
}
Returner BARE JSON, ingen annen tekst.`;

export async function analyzeEmailPuls(input: {
  contactName: string;
  currentSignal: string | null;
  currentTechnologies: string[];
  emails: Array<{ subject: string; body_text: string; received_at: string }>;
}): Promise<EmailPulsResult | null> {
  const emailText = input.emails
    .slice(0, 5)
    .map((e) => {
      const body = (e.body_text || "").slice(0, 500);
      return `[${e.received_at?.slice(0, 10)}] Emne: ${e.subject}\n${body}`;
    })
    .join("\n---\n");

  const userContent = `Kontakt: ${input.contactName}
Nåværende signal: ${input.currentSignal || "ingen"}
Eksisterende teknologier: ${input.currentTechnologies.length > 0 ? input.currentTechnologies.join(", ") : "(ingen)"}

E-poster:
${emailText}`;

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
    return JSON.parse(text) as EmailPulsResult;
  } catch {
    return null;
  }
}
