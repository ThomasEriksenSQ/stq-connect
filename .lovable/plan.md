

## Plan: Flytt CV-editor og Finn oppdrag til ansattsiden

### Oversikt
Fjern "CV-editor"-knappen (+ "X siden"-tekst) og "Finn oppdrag"-knappen fra ansatt-tabellen. Legg dem til i headeren på ansattdetaljsiden (`AnsattDetail.tsx`). Tabellen beholder kun Rediger-knappen og Profil-knappen.

### 1. `src/pages/KonsulenterAnsatte.tsx` — Fjern kolonner

- **Fjern CV-kolonnen** (CV-editor-knapp + relativ tid) og **Finn oppdrag-knappen** fra HANDLINGER
- **Oppdater GRID_COLS** fra 8 kolonner til 6: `[minmax(0,2.2fr)_95px_100px_90px_80px_64px]`
- **Oppdater header-array** til `["NAVN", "START", "ANSETTELSE", "OPPDRAG", "FORNYES", ""]`
- **Siste kolonne** beholder kun Rediger-knapp og Profil-knapp side om side
- Fjern ubrukte imports (`ExternalLink`, `Sparkles`) og `cvRelativeTime`-funksjonen, `cvDocs`-queryen, `cvDataMap` osv. hvis de ikke brukes andre steder
- Fjern `autoRunMatch`-state og tilhørende logikk fra `AnsattDetailSheet`-kallet

### 2. `src/pages/AnsattDetail.tsx` — Legg til knapper i headeren

I header-seksjonen (ved siden av navn/status-badge), legg til to knapper til høyre:

```text
[Bilde]  Navn                          [✨ Finn oppdrag]  [🔗 CV-editor]
         Aktiv-badge
```

- **CV-editor**: Navigerer til `/cv-admin/${ansatt.id}`, med `ExternalLink`-ikon, samme stil som dagens knapp
- **Finn oppdrag**: Åpner `AnsattDetailSheet` med `autoRunMatch=true`, med `Sparkles`-ikon

Legg til nødvendig state (`detailOpen`, `autoRunMatch`) og import av `AnsattDetailSheet`, `Sparkles`, `ExternalLink`.

### Filer som endres
- `src/pages/KonsulenterAnsatte.tsx`
- `src/pages/AnsattDetail.tsx`

