

## Plan: Fiks to problemer med E-post-puls

### Problem 1: "rådgiver" i stedet for "konsulent"
AI-en bruker ordet "rådgiver" i begrunnelsen fordi prompten ikke spesifiserer terminologi. Løsning: legg til instruksjon i system-prompten i både `aiEmailPuls.ts` og `aiSignal.ts`.

### Problem 2: E-poster forsvinner fra tidslinjen
`EmailPulsBanner` har sin egen `useQuery` med samme cache-key (`["outlook-emails", contactEmail]`) men returnerer rådata i et annet format enn `ContactCardContent`. Når begge bruker samme key, overskriver den ene den andres data — tidslinjen får feil format og viser ingenting.

**Løsning:** Endre `EmailPulsBanner` til å bruke en annen query-key (f.eks. `["email-puls-emails", contactEmail]`) slik at den ikke kolliderer med timeline-cachen.

### Endringer

**1. `src/lib/aiEmailPuls.ts`** — Legg til i system-prompt:
`Bruk alltid "konsulent" — aldri "rådgiver", "ekspert" eller "spesialist".`

**2. `src/lib/aiSignal.ts`** — Samme tillegg i system-prompt.

**3. `src/components/EmailPulsBanner.tsx`** — Endre queryKey fra `["outlook-emails", contactEmail]` til `["email-puls-emails", contactEmail]` for å unngå cache-konflikt med tidslinjen.

