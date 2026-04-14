

# Plan: Design Lab Kontakter — Redesign basert på feedback

## Sammendrag

Omstrukturere detaljpanelet fra passiv profilvisning til et aktivt "decision panel" med tydelig visuelt hierarki, neste-handling fokus, og bedre kontaktliste. Basert på GPT/Claude-feedback + eget skjønn innenfor V8-designspråket.

## Endringer

### 1. Kontaktlisten (venstre kolonne) — Økt informasjonsverdi per rad

**Nå:** Navn + liten firma-tekst under, signal-chip, heat-badge.

**Nytt:**
- Legg til **avatar-sirkel** (initialer, 28px, nøytral bg) til venstre for navn
- **Valgt rad:** Tydeligere — sterkere bakgrunnsfarge + 2px venstre border i accent-farge
- Kompakt-modus: Vis "siste aktivitet" som liten grå tekst (f.eks. "3d") ved siden av heat-badge
- Full-modus: Legg til kolonne "Siste" (relativ tid) mellom Eier og Varme

### 2. Detaljpanel — Fra profil til "Decision Panel"

Erstatt nåværende layout (V8-header + ContactCardContent) med et **egenbygd detaljpanel** i V8-stil som er strukturert for handling.

**Ny layout i detaljpanelet (ovenfra og ned):**

```text
┌─────────────────────────────────────────────┐
│  [Avatar 40px]  NAVN (18px bold)        [X] │
│                 Selskap · Stilling · Sted    │
│                 [Signal] [Innkjøper] [CV]    │
├─────────────────────────────────────────────┤
│  LEFT META (160px)  │  RIGHT CONTENT        │
│                     │                        │
│  KONTAKT            │  NESTE HANDLING        │
│  email (link)       │  ┌──────────────────┐  │
│  telefon (link)     │  │ "Følg opp..."    │  │
│                     │  │ [Logg aktivitet] │  │
│  BEHOV              │  └──────────────────┘  │
│  ○ Behov nå         │                        │
│  ○ Fremtidig        │  AKTIVITETER · 36      │
│  ○ Kanskje          │  ┌─ Jun 2024 ──────┐  │
│  ○ Ukjent           │  │ ● Samtale med.. │  │
│                     │  │   2-line clamp   │  │
│  NESTE OPPFØLGING   │  │ ● Møte hos...   │  │
│  16. jan 2025       │  │   2-line clamp   │  │
│  Om 2 dager         │  └─────────────────┘  │
│                     │                        │
│  HEAT SCORE         │                        │
│  82 (stor, farget)  │                        │
│  B · IN · FO_nær    │                        │
│                     │                        │
│  INNKJØPER  [toggle]│                        │
│  CV-EPOST   [toggle]│                        │
└─────────────────────┴────────────────────────┘
```

### 3. Neste handling-boks (GPTs viktigste punkt)

Øverst i høyre innholdsdel av detaljpanelet:
- Viser neste oppfølging med tittel og dato (rød hvis forfalt, gul hvis i dag)
- Én primær CTA: **"Logg aktivitet"** (teal) med dropdown for type (Samtale / Møte / Notat)
- Én sekundær: **"Ny oppfølging"** (ghost)
- Hvis ingen oppfølging: vis "Ingen planlagt oppfølging" + prominent "Ny oppfølging"-knapp

### 4. Aktivitetsfeed i detaljpanelet

Egen scrollbar (overflow-y:auto), ikke delt med header:
- Fargede dots: grønn=samtale, blå=møte, amber=task
- **line-clamp: 2** på beskrivelser (ikke ubegrenset)
- Tydelig `border-bottom` mellom items
- Månedsheadere som små uppercase labels
- Rensede titler: fjern "Svar: SV: SV:" prefixer via `cleanDescription`

### 5. Heat score-visning i venstre meta-kolonne

Stor numerisk verdi (24px, farget etter temperatur), under: breakdown med kodeforkortelser (B, IN, FO_nær osv.) i 11px muted tekst.

### 6. Behov-velger i venstre meta-kolonne

Vertikale pills (ikke horisontale som nå). Valgt = filled accent, andre = ghost border. Klikk endrer signal direkte (mutation mot Supabase).

### 7. Filter-chips: Legg til Varme-filter

Ny filterrad "VARME" med chips: Alle / Hett / Lovende / Mulig / Sovende. Filtrerer på `heatResult.temperature`.

## Tekniske endringer

### `src/pages/DesignLabContacts.tsx` (hovedfil — omfattende endringer)

1. **Kontaktrad:** Legg til avatar-sirkel (initialer), sterkere valgt-rad styling
2. **Ny `DetailPanel`-komponent** (inline i filen): Erstatter `ContactCardContent` med egenbygd V8-panel
   - Venstre meta-kolonne (160px): kontaktinfo, behov-velger, oppfølging, heat score, toggles
   - Høyre innholdsdel: neste-handling boks + aktivitetsfeed med egen scroll
3. **Ny `NextActionBox`-komponent**: Viser neste oppfølging + "Logg aktivitet" dropdown
4. **Ny `ActivityFeed`-komponent**: Kompakt tidslinje med line-clamp, fargede dots, månedsgruppert
5. **Signal mutation**: Gjenbruk `upsertTaskSignalDescription` fra categoryUtils for å endre signal
6. **Ny filterrad** "VARME" med temperature-chips
7. **Ny SortField** `"last_activity"` kolonne i full-modus grid

### `src/lib/cleanDescription.ts` (ingen endringer — gjenbrukes for tittelrensing)

### Ingen andre filer endres
All logikk (queries, mutations, heat score) er allerede på plass. Detaljpanelet bygges fra scratch i V8-stil istedenfor å wrappe `ContactCardContent`.

## Hva dette IKKE endrer
- Eksisterende kontaktside (`/kontakter`) — upåvirket
- Sidebar-navigasjon — beholdes som den er
- Queries og mutations — gjenbrukes uendret
- V8 fargepalett og typografi — beholdes

