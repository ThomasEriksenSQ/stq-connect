

# Plan: STACQ Prisen i Design Lab V8-stil

## Konsept

STACQ Prisen-siden redesignet i V8-estetikken: varm off-white bakgrunn, dempede farger, 3-sone layout med sidebar, og samme visuelle språk som de andre Design Lab-sidene.

## Visuell beskrivelse

```text
┌──────────┬──────────────────────────────────────────────────────────────┐
│ SIDEBAR  │  STACQ Prisen                                              │
│ 216px    │                                                            │
│          │  kr 4 639/t · 14 konsulenter · snitt 331/t · +210 oppstart │
│ Kontakter│                                                            │
│ Selskaper│  ┌──────────────────────────────────────────────────────┐   │
│ Forespør.│  │  ▁▂▃▄▅▆▇█  (area chart, teal gradient)             │   │
│ Ansatte  │  │  ─ ─ ─ ─ ─  Mål: 5 000                            │   │
│▸STACQ Pr.│  └──────────────────────────────────────────────────────┘   │
│          │                                                            │
│          │  BIDRAG PER KONSULENT                                      │
│          │  Konsulent   Kunde     Type  Utpris  STACQ   %   Status   │
│          │  ─────────────────────────────────────────────────────────  │
│          │  Ola N.      Equinor   DIR   1400    420    30%  Aktiv     │
│          │  Kari S.     Telenor   VIA   1200    360    30%  Oppstart  │
└──────────┴──────────────────────────────────────────────────────────────┘
```

## V8-tilpasninger

### Stat-kort → Stat-linje
- Fjerner de fire fargede kortene. Erstattes med en enkel tekstlinje i `textMuted`-farge
- Format: "kr 4 639/t · 14 konsulenter · snitt 331/t · +210 oppstart"

### Chart
- Beholder area chart men med V8-farger: teal gradient istedenfor emerald
- Borders: `C.border`, bakgrunn: `C.surface`
- Aksene og tooltip i V8-typografi

### Tabell
- 11px uppercase kolonneheadere, `C.textMuted`, weight 600
- Rader med `C.border` dividers, hover `C.hoverBg`
- Status-badges: desaturerte V8-farger (ikke mettede Tailwind)
- Type-badges: nøytrale V8-toner
- STACQ Pris-verdier: dempet teal for høye, nøytrale for lave (istedenfor emerald/blue/amber)
- Klikk på rad åpner edit-dialog wrappet i `.dl-v8-theme`

### Edit-modal
- Wrappet i `.dl-v8-theme` for automatisk reskinning
- Pill-buttons, dempede inputs

## Tekniske endringer

### 1. Ny fil: `src/pages/DesignLabStacqPrisen.tsx`
- Kopierer datalogikk fra `StacqPrisen.tsx` (queries, beregninger, sortering)
- Erstatter all styling med V8 `C.*` konstanter (inline styles)
- Sidebar-navigasjon (delt med andre Design Lab-sider) med "STACQ Prisen" markert
- Stat-linje istedenfor stat-kort
- Chart med teal-gradient og V8-aksefarge
- Tabell med V8-styling og desaturerte badges
- Edit-modal med V8-tema

### 2. `src/App.tsx` — Ny rute
- Legg til `/design-lab/stacq-prisen` i ProtectedMinimal-gruppen

### 3. Sidebar-oppdatering
- Legg til "STACQ Prisen"-lenke med TrendingUp-ikon i sidebar-navigasjonen i `DesignLabContacts.tsx` og `DesignLabForesporsler.tsx`

