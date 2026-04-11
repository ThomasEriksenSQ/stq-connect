

## Oppdatert plan: Outlook e-poster i aktivitetstidslinjen

### Evaluering: Ekspander/lukk per e-post

**Anbefaling: Ja, e-poster skal vises kollapset som standard med ekspander/lukk.**

**Begrunnelse:**

1. **E-poster er lengre enn samtalenotater.** Dagens aktiviteter har korte beskrivelser (1-3 linjer). E-poster kan være 10-50+ linjer med signaturer, tråder og formatering. Å vise alt ekspandert ville drukne tidslinjen.

2. **Mønsteret finnes allerede.** `ActivityRow` har en `expanded`-state, og `DescriptionText`-komponenten bruker `line-clamp` for å kutte tekst. E-poster følger samme mønster.

3. **Skanning vs. lesing.** Brukerne (Jon Richard/Thomas) skanner tidslinjen for kontekst. Subject-linjen er nok til å gjenkjenne en e-post. Klikk for å lese detaljer ved behov.

### Hvordan e-poster vises i tidslinjen

**Kollapset (standard):**
```text
📧 Re: Rammeavtale konsulenter              14. mars 2026
   Fra: erik@kunde.no → thomas@stacq.no
```

**Ekspandert (etter klikk på chevron):**
```text
📧 Re: Rammeavtale konsulenter              14. mars 2026
   Fra: erik@kunde.no → thomas@stacq.no
   ─────
   Hei Thomas,
   Takk for CVene. Vi ønsker å kalle inn Karl Eirik
   til intervju neste uke. Passer tirsdag?
   
   Mvh Erik
```

### Implementasjonsdetaljer

- E-post-rader i tidslinjen får et **Mail-ikon** (lilla/blå) på spine
- Subject som tittel, avsender/mottaker som metarad
- Body vises med `line-clamp-2` kollapset, full tekst ekspandert
- Chevron-ikon (ChevronDown) roterer ved ekspandering — samme mønster som `DescriptionText`
- E-poster er **read-only** — klikk på rad åpner ikke inline-redigering, bare ekspander/lukk
- HTML-body strippes til ren tekst for visning

### Resten av planen (uendret)

1. **Secrets**: Lagre `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`
2. **Database**: `outlook_tokens`-tabell med RLS
3. **Edge function `outlook-auth`**: OAuth-flyt med callback
4. **Redirect URI**: Bruker legger til i Entra-portalen
5. **Edge function `outlook-mail`**: Henter e-poster fra Microsoft Graph, filtrert på kontaktens e-post
6. **Frontend**: E-poster merges inn i `ActivityTimeline` i `ContactCardContent.tsx`, sortert kronologisk med eksisterende aktiviteter. E-poster vises kollapset med ekspander/lukk.

### Filer som endres/opprettes

| Fil | Handling |
|-----|----------|
| `supabase/functions/outlook-auth/index.ts` | Ny |
| `supabase/functions/outlook-mail/index.ts` | Ny |
| Migration: `outlook_tokens`-tabell | Ny |
| `src/components/ContactCardContent.tsx` | Endre ActivityTimeline til å støtte e-poster |

