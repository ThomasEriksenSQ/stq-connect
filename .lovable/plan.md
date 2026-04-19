
## Funn

`src/pages/DesignLabOppfolginger.tsx` viser i dag en tabell der hver rad har:
- Tittel ("Følg opp om behov") på første linje
- "Selskap · Kontakt" stablet på linje to under tittelen
- Kolonner: OPPFØLGING | EIER | DATO | PRIORITET

Brukeren vil splitte den stablede teksten i to egne kolonner, slik at layouten blir:

`OPPFØLGING | KONTAKT | SELSKAP | EIER | DATO | PRIORITET`

## Plan

Endre kun grid-layouten (header + radene) i `DesignLabOppfolginger.tsx`. Ingen endringer i datahenting, sortering, filtrering eller detaljpanel.

### Fil
- `src/pages/DesignLabOppfolginger.tsx`

### Endringer

1. **Grid-template**: utvid fra dagens 4 kolonner (oppfølging | eier | dato | prioritet) til 6 kolonner:
   - Oppfølging (fleksibel, `minmax(0,1fr)`)
   - Kontakt (fast, ~220px)
   - Selskap (fast, ~240px)
   - Eier (fast, ~140px)
   - Dato (fast, ~90px, høyrejustert)
   - Prioritet (fast, ~70px, høyrejustert)

   Dette følger V2 ultrawide-regelen (memory): metadata-kolonner med faste pikselbredder, navn/tittel som flex.

2. **Header-rad** (kolonnetitler i caps): legg til `KONTAKT` og `SELSKAP` mellom `OPPFØLGING` og `EIER`, samme typografi som de andre (11px/500/uppercase, `C.textMuted`), gjenbruker eksisterende stil.

3. **Datarad**:
   - Kolonne 1 (Oppfølging): kun tittelen ("Følg opp om behov"), ikke lenger to-linjers stack.
   - Kolonne 2 (Kontakt): kontaktnavn, eller `—` dersom ingen kobling.
   - Kolonne 3 (Selskap): selskapsnavn, eller `—` dersom ingen kobling.
   - Kolonner 4–6: uendret (Eier-chip, dato, prioritet-pill).

4. **Tekststiler**:
   - Tittel: 13px / 500 / `C.text` (uendret)
   - Kontakt + Selskap: 13px / 400 / `C.textMuted`, `truncate` for å tåle smale visninger
   - "—" når tomt: `C.textGhost`

### Utenfor scope
- V1-Tasks (`/oppfolginger`).
- Filtre, sortering, detaljpanel, ⌘K-søk.
- Andre Design Lab-sider.

### Hvorfor lav-risk
- Ren visuell omstrukturering av én tabell.
- Samme datakilder brukes — bare flyttet fra stack til separate celler.
- Følger eksisterende V2-mønstre (faste meta-bredder, fleksibel tittel) som allerede brukes i Forespørsler/Kontakter.
