

# Plan: Radikal redesign — "STACQ Studio"

## Teamets mandat

Det nåværende Design Lab-designet er en oppusset versjon av det eksisterende CRMet: hvit bakgrunn, grå tekst, tradisjonell tabell. Vi kaster det og starter fra null.

## Nytt konseptteam

**Art Director (Yuki)**: CRM-er ser ut som regneark. Vi bygger et *instrument* — som et musikkstudio eller en cockpit. Mørk bakgrunn gir fokus og premium-følelse. Hvit tekst på mørkt er mer behagelig over lange arbeidsøkter.

**Informasjonsarkitekt (Priya)**: Tabeller er feil primitiv for kontakter. En kontakt er en *relasjon med historie* — ikke en rad. Vi grupperer kontakter etter signal-status som vertikale "lanes" (kanban-inspirert), men rendret som en kompakt liste innenfor hver gruppe.

**Typografi/lesbarhet (Emil)**: På mørk bakgrunn må vi bruke en lettere font-vekt (400 for brødtekst, 500 for emphasis) og øke linjeavstand. Geist Sans (Vercels font) gir en skarpere, mer teknisk følelse enn Inter.

**Interaksjonsdesigner (Noor)**: Keyboard-first. `⌘K` for alt. Kontakter navigeres med piltaster. Escape lukker paneler. Ingen dropdown-menyer — alt er inline eller via command palette.

## Visuelt konsept: Mørk, immersiv arbeidsflate

```text
┌──────────────────────────────────────────────────────────────────┐
│  STACQ                           ⌘K Søk…              ◯ JRN   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ BEHOV NÅ (4) ──────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  Erik Solberg        Aker Solutions     Python ML    1d  │    │
│  │  Kari Hansen         DNB               Java Kotlin  3d  │    │
│  │  Silje Strand        Schibsted         Spark        2d  │    │
│  │  Camilla Roth        Vipps             Kotlin Swift i dag│    │
│  │                                                          │    │
│  ├─ FREMTIDIG (3) ─────────────────────────────────────────┤    │
│  │                                                          │    │
│  │  Lars Moen           Equinor           Azure DevOps 1u  │    │
│  │  Marte Olsen         Telenor Digital   React TS     2u  │    │
│  │  ...                                                     │    │
│  │                                                          │    │
│  ├─ KANSKJE (2) ───────────────────────────────────────────┤    │
│  │  ...                                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│          ┌────────────────────────────────────────┐              │
│          │  ERIK SOLBERG                          │              │
│          │  Tech Lead · Aker Solutions            │              │
│          │                                        │              │
│          │  ● Behov nå   CV   JRN                │              │
│          │                                        │              │
│          │  erik.solberg@aker.no  +47 900 11 222  │              │
│          │  Python · ML · GCP                     │              │
│          │                                        │              │
│          │  ─── Neste ────────────────────────    │              │
│          │  □ Finn ML-kandidat      16. apr       │              │
│          │                                        │              │
│          │  ─── Siste ────────────────────────    │              │
│          │  📞 Hastebehov ML        13. apr       │              │
│          │     Prosjektet er forsinket...         │              │
│          └────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

## Nøkkelinnovasjoner vs. nåværende

| Aspekt | Nåværende Design Lab | Ny "Studio" |
|--------|---------------------|-------------|
| Bakgrunn | Hvit (#FAFBFC) | Mørk (#0A0A0F) |
| Layout | Flat tabell med kolonner | Signal-grupperte seksjoner |
| Fargebruk | Grå + indigo aksent | Mørk base + luminøse aksenter |
| Rad-design | Alle like, sorteres | Gruppert etter status, kontekst synlig |
| Typografi | Inter | Geist Sans (system-ui fallback) |
| Navigasjon | Egen topbar "Design Lab" | Minimal topbar, maks plass til data |
| Detaljpanel | Slide-over fra høyre | Sentrert modal-overlay med blur-bakgrunn |
| Kontaktside | Hvite kort på grå bg | Mørk helside med tydelige seksjoner |
| Filtre | Horisontale pills | Inline i søkefelt (type-ahead facets) |
| Interaksjon | Klikk-basert | Keyboard-first + klikk |

## Fargepalett — "Obsidian"

- **Base**: `#0A0A0F` (nesten svart, varm undertone)
- **Surface**: `#16161F` (kort, paneler)
- **Elevated**: `#1E1E2A` (hover, aktive elementer)
- **Border**: `#2A2A3C` (subtil, kun der nødvendig)
- **Tekst primær**: `#EDEDF0` (98% hvit, ikke ren hvit)
- **Tekst sekundær**: `#8B8B9E`
- **Tekst tertiær**: `#55556A`
- **Aksent**: `#6C5CE7` (varm lilla — skiller seg fra indigo)
- **Signal Behov nå**: `#00D68F` (neon-grønn)
- **Signal Fremtidig**: `#4DA6FF` (klar blå)
- **Signal Kanskje**: `#FFB347` (varm gul)
- **Signal Ukjent**: `#55556A` (muted)
- **Signal Aldri**: `#FF6B6B` (myk rød)

## Typografi — Geist Sans

| Rolle | Størrelse | Vekt | Farge |
|-------|----------|------|-------|
| Sidetittel | 24px | 600 | #EDEDF0 |
| Gruppe-header | 11px | 600 | signal-farge, uppercase, tracking 0.12em |
| Kontaktnavn (rad) | 14px | 500 | #EDEDF0 |
| Selskap (rad) | 13px | 400 | #8B8B9E |
| Tech-tags | 11px | 400 | #8B8B9E, border #2A2A3C |
| Tid | 12px | 400 | #55556A |
| Panel-tittel | 18px | 600 | #EDEDF0 |
| Panel-brødtekst | 13px | 400 | #8B8B9E |

## Kontaktlisten — signal-gruppert

I stedet for en flat tabell, grupperes kontakter etter signal. Hver gruppe har:
- En tynn, farget header-linje med signal-navn og antall
- Kompakte rader under (kontaktnavn, selskap, tech-tags, relativ tid)
- Grupper kan kollapses
- Raden har en subtil glow-effekt ved hover

## Kontaktdetalj — immersiv fullside

Mørk helside med:
- Stort navn øverst, subtle gradient-linje under i signal-farge
- To-kolonne layout: venstre = kontaktinfo + tech, høyre = snapshot
- Under: oppfølginger som interaktive kort med checkbox
- Under: aktivitetstidslinje med fargekodet ikon per type
- Notater som et redigerbart felt med monospace-font

## Implementering

### Filer

1. **`src/pages/DesignLabContacts.tsx`** — fullstendig omskrivning med mørkt tema, signal-gruppering, Geist Sans, keyboard-navigering, sentrert detaljoverlay
2. **`src/pages/DesignLabContactDetail.tsx`** — fullstendig omskrivning med mørk immersiv layout
3. **`src/App.tsx`** — ingen endring (ruter finnes allerede)

### Avgrensning
- Ingen endringer i eksisterende CRM
- Alt mockdata, ingen database
- Geist Sans lastes via Google Fonts CDN-link i komponenten
- All styling er inline Tailwind med arbitrary values, scoped til `.design-lab`

