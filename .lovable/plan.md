

# Plan: Forespørsler-side i Design Lab V8-stil

## Konsept

Forespørsler-siden redesignet i Linear-inspirert V8-estetikk: varm off-white bakgrunn, ultra-subtile bordere, dempet teal-aksent, og samme 3-sone layout som Design Lab Kontakter (sidebar + tabell + detaljpanel).

## Visuell beskrivelse

```text
┌──────────┬─────────────────────────────────────────┬──────────────────────┐
│ SIDEBAR  │  Forespørsler                    22     │  DETALJPANEL         │
│ 216px    │                                         │  (resizable)         │
│          │  TID    ○ Aktive  ○ Utgåtte  ○ Alle     │                      │
│ Kontakter│  TYPE   ○ Alle  ○ Direkte  ○ Partner    │  Selskap: Equinor    │
│ Selskaper│                                         │  Kontakt: Ola N.     │
│▸Forespør.│  ┌─────────────────────────────────────┐│  Teknologier: ...    │
│ Ansatte  │  │ Mottatt  Selskap    Kontakt  Type   ││  Pipeline: ●──●──○   │
│ Konsul.  │  │─────────────────────────────────────││  Konsulenter sendt:  │
│          │  │ 2d       Equinor   Ola N.   DIR    ││  ...                 │
│          │  │ 5d       Telenor   Kari S.  VIA    ││                      │
│          │  │ 1u       DNB       Per H.   DIR    ││                      │
│          │  └─────────────────────────────────────┘│                      │
└──────────┴─────────────────────────────────────────┴──────────────────────┘
```

## V8-tilpasninger sammenlignet med dagens design

### Stat-kort (fjernes eller forenkles)
- De fire fargede stat-kortene (blå/amber/emerald) erstattes med en enkel tekstlinje: "22 aktive · 4 uten konsulent · 3 i prosess · 1 vunnet" i `textMuted`-farge, uten fargede bakgrunner

### Filter-chips
- Samme horisontale pill-layout som Design Lab Kontakter
- Aktiv chip: teal (`#01696F`) bakgrunn med hvit tekst
- Inaktiv chip: `rgba(40,37,29,0.08)` border, `textMuted` farge
- Ingen `bg-foreground` / `text-background` (produksjons-stil)

### Tabell
- Bakgrunn: `C.surface` (#FFFFFF) med `C.border` ramme
- Kolonneheadere: 11px uppercase, `textMuted`, weight 600, tracking 0.06em
- Rader: `divide-y` med `C.borderLight`, hover `C.hoverBg`
- Aktiv rad: `C.activeBg` (teal 4% opacity)
- Type-badges: desaturerte V8-farger (ikke mettede Tailwind-farger)
- Pipeline-dots: dempede, nøytrale farger istedenfor sterke amber/blue/green
- Teknologi-tags: `C.border` outline, ingen fylt bakgrunn

### Detaljpanel
- Integrert i ResizablePanelGroup (som kontakter)
- Wrappet i `.dl-v8-theme` for automatisk reskinning av ForespørselSheet
- Åpnes ved klikk på rad, ikke i Sheet/modal

### Sidebar
- Gjenbruker samme sidebar-komponent som DesignLabContacts med "Forespørsler" markert som aktiv

## Tekniske endringer

### 1. Ny fil: `src/pages/DesignLabForesporsler.tsx`
- Kopierer datalogikk fra `Foresporsler.tsx` (query, filtrering, sortering)
- Erstatter all styling med V8 `C.*` konstanter (inline styles)
- 3-sone layout: sidebar + tabell + resizable detaljpanel
- Stat-linje istedenfor stat-kort
- V8-stilede filter-chips, tabellrader og badges
- ForespørselSheet wrappet i `.dl-v8-theme`

### 2. `src/App.tsx` — Ny rute
- Legg til `/design-lab/foresporsler` i ProtectedMinimal-gruppen

### 3. Sidebar-oppdatering i DesignLabContacts
- Legg til "Forespørsler"-lenke i sidebar-navigasjonen (delt mellom begge Design Lab-sider)

