

## Plan: E-post-puls — AI-analyse av e-poster for salgssignaler

### Konsept
Når kontaktsiden lastes og det finnes Outlook-e-poster, sendes de nyeste e-postene til AI som analyserer innholdet og returnerer:
- Anbefalt salgssignal med begrunnelse
- Teknologier nevnt i e-postene (auto-tagges)
- Eventuell tidsramme nevnt ("Q3", "etter sommeren")

Resultatet vises i et banner likt det eksisterende `AiSignalBanner`, men med e-post-ikon og ekstra info om identifiserte teknologier.

### Arkitektur

```text
ContactCardContent.tsx
  └─ useQuery("outlook-emails")     ← allerede finnes
  └─ <EmailPulsBanner>              ← NY komponent
       └─ analyzeEmailSignal()      ← NY lib-funksjon
            └─ POST /functions/v1/chat  ← gjenbruk eksisterende edge function
```

Ingen ny edge-funksjon trengs. Vi gjenbruker `chat`-funksjonen med en spesialisert system-prompt, akkurat som `analyzeSignal` gjør i dag.

### Endringer

**1. Ny fil: `src/lib/aiEmailPuls.ts`**
- Eksporterer `analyzeEmailPuls()`-funksjonen
- Tar inn: kontaktnavn, nåværende signal, teknologier, og de 5 nyeste e-postene (subject + body_text, maks 500 tegn per e-post)
- System-prompt instruerer AI til å returnere JSON med tool calling:
  - `anbefalt_signal` — et av de 5 standardsignalene
  - `begrunnelse` — maks 20 ord, norsk, refererer til spesifikt e-postinnhold
  - `konfidens` — høy/middels/lav
  - `teknologier_funnet` — array med teknologier/rammeverk nevnt i e-postene
  - `tidsramme` — valgfri streng ("Q3 2026", "etter sommeren" etc.)
- Kaller `/functions/v1/chat` med `system` og `messages`, identisk mønster som `analyzeSignal`
- Trunkerer e-postinnhold for å holde token-bruk lav

**2. Ny fil: `src/components/EmailPulsBanner.tsx`**
- Props: `contactId`, `contactName`, `currentSignal`, `currentTechnologies`, `emails`, `onUpdateSignal`, `onAddTechnologies`
- Kaller `analyzeEmailPuls` i `useEffect` ved mount (med dismiss-sjekk via localStorage)
- Viser resultat som banner med:
  - Mail-ikon (ikke Sparkles) + "E-post-puls" label
  - Anbefalt signal med badge (gjenbruk `getBadgeColor`)
  - Begrunnelse med sitat fra e-post
  - Teknologier funnet som klikkbare chips
  - Tidsramme om identifisert
  - "Oppdater signal"-knapp (oppdaterer kategori + logger aktivitet)
  - "Legg til teknologier"-knapp (kun hvis nye teknologier funnet som ikke allerede er på kontakten)
  - "Ignorer"-knapp (lagrer i localStorage med key `dismissed_email_puls_${contactId}`)
- Vises IKKE hvis:
  - Ingen e-poster
  - Allerede dismissed
  - Anbefalt signal === nåværende signal OG ingen nye teknologier

**3. Oppdater `src/components/ContactCardContent.tsx`**
- Importer `EmailPulsBanner`
- Plasser rett under eksisterende `AiSignalBanner` (linje ~1133)
- Send inn `outlookEmails` fra `ActivityTimeline` oppover (eller flytt e-post-fetching opp til `ContactCard`-nivå slik at begge har tilgang)
- Alternativt: la `EmailPulsBanner` selv hente e-poster via `useQuery` med samme cache-key (`["outlook-emails", contactEmail]`), som allerede er cachet av `ActivityTimeline`

**Valgt tilnærming for datadeling:** `EmailPulsBanner` bruker sin egen `useQuery` med samme cache-key. React Query returnerer cachet data uten nytt nettverkskall. Dette unngår refaktorering av prop-drilling.

### System-prompt for e-post-puls

```text
Du er CRM-assistent for STACQ, et norsk IT-konsulentbyrå som leverer embedded/firmware/C/C++-konsulenter.
Analyser e-postene mellom STACQ og kontakten. Identifiser:
1. Salgssignal: Er det tegn til behov for konsulenter?
2. Teknologier: Hvilke teknologier/rammeverk nevnes?
3. Tidsramme: Nevnes det når et eventuelt behov oppstår?

Svar KUN med JSON:
{
  "anbefalt_signal": "Behov nå" | "Får fremtidig behov" | "Får kanskje behov" | "Ukjent om behov" | "Ikke aktuelt",
  "begrunnelse": "maks 20 ord, norsk, referer til konkret e-postinnhold",
  "konfidens": "høy" | "middels" | "lav",
  "teknologier_funnet": ["C++", "RTOS", ...],
  "tidsramme": "Q3 2026" | null
}
```

### Kostnad og ytelse
- Gjenbruker cachet e-poster (ingen ekstra API-kall til Outlook)
- Sender maks 5 e-poster × 500 tegn = ~2500 tegn til AI — svært lavt token-bruk
- Dismiss-mekanisme i localStorage forhindrer gjentatte AI-kall for samme kontakt
- Ny analyse trigges kun når `contactId` eller antall e-poster endres

### Filer som endres/opprettes
| Fil | Type |
|-----|------|
| `src/lib/aiEmailPuls.ts` | Ny |
| `src/components/EmailPulsBanner.tsx` | Ny |
| `src/components/ContactCardContent.tsx` | Oppdatert — legg til banner |

Ingen database-endringer. Ingen nye edge-funksjoner. Ingen nye hemmeligheter.

