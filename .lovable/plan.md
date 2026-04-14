

# Ærlig vurdering + Anbefalt retning

## Diagnosen

Du har rett. Etter 7 iterasjoner har Design Lab-kontaktsiden nesten identisk **informasjonsarkitektur** som dagens CRM:

```text
DAGENS CRM                          DESIGN LAB V7
─────────────────                    ─────────────────
Navn + eier-badge                    Navn + eier-badge
Selskap · Sted · Stilling            Selskap · Sted · Stilling
Telefon | E-post | LinkedIn          Telefon | E-post | LinkedIn
CV-Epost / Innkjøper / Ikke rel.    CV-Epost / Innkjøper / Ikke rel.
Teknisk DNA tags                     Teknisk DNA tags
Notat textarea                       Notat textarea
Action-knapper                       Action-knapper
Oppfølginger                         Oppfølginger
Aktivitetstidslinje                  Aktivitetstidslinje
Konsulentmatch                       Konsulentmatch
```

Det eneste som er endret er `border-border` → `rgba(0,0,0,0.06)` og `text-foreground` → `#111827`. Bokstavelig talt samme farger, bare skrevet annerledes.

**Hvorfor**: Project-knowledge definerer et rigid typografi- og komponent-system som alle iterasjoner har fulgt slavisk. Resultatet er at "nytt design" alltid konvergerer til den eksisterende stilen.

## Anbefalt retning: "Attio Record Page"

Basert på research av Attios faktiske record page-arkitektur, som er **fundamentalt annerledes** i hvordan den organiserer informasjon:

### Hva Attio gjør annerledes

Attio bruker tre arkitektoniske grep vi ikke har:

1. **Highlight-widgets øverst** — 3-6 nøkkelmetrikker som kort (Connection Strength, Siste interaksjon, Siste e-post). Ikke bare tekst-metadata, men visuelt fremhevede KPI-er med ikoner og farger.

2. **Tab-basert innhold** — Oversikt / Aktivitet / E-post / Oppfølginger som faner. I stedet for én lang scrollbar med alt, ser du bare det du trenger.

3. **Persistent høyre-sidebar** — Alle attributter (signal, eier, teknologier, status-toggles) som key-value par i et smalt sidebar-panel. Hovedinnholdet (sentrum) er rent og fokusert på handlinger og tidslinje.

### Konkret layout

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Tilbake     STACQ     Kontakter  Selskaper  Oppdrag       [⌘K]  JR │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Henrik Berg                              [Ring] [E-post] [Logg]  [⋮]  │
│  Platform Lead · Equinor                                                 │
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ SIGNAL      │ │ SISTE       │ │ NESTE       │ │ MATCH       │       │
│  │ ● Behov nå  │ │ 2 dager     │ │ 15. apr     │ │ 93% best    │       │
│  │             │ │ Samtale     │ │ Presentere  │ │ Kristian H  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                                          │
│  ┌─ Oversikt ─┬─ Aktivitet ─┬─ Oppfølginger ─┐    ┌─ DETALJER ────────┐│
│  │                                             │    │                    ││
│  │  NOTAT                                      │    │  Signal            ││
│  │  ┌─────────────────────────────────────┐    │    │  ● Behov nå    ▾   ││
│  │  │ Henrik har mandat til å bruke ...   │    │    │                    ││
│  │  └─────────────────────────────────────┘    │    │  Eier              ││
│  │                                             │    │  Jon Richard N.    ││
│  │  KONSULENTMATCH                             │    │                    ││
│  │  Kristian Haugen  93%  K8s Terraform Azure  │    │  Selskap           ││
│  │  Emilie Aasen     87%  Docker CI/CD AWS      │    │  Equinor        →  ││
│  │                                             │    │                    ││
│  │  SISTE AKTIVITET                            │    │  Avdeling          ││
│  │  12. apr — DevOps-behov for plattformteam   │    │  Digital Platform  ││
│  │  14. mar — Første møte — kartlegging        │    │                    ││
│  │                                             │    │  Stilling          ││
│  │                                             │    │  Platform Lead     ││
│  │                                             │    │                    ││
│  │                                             │    │  Sted              ││
│  │                                             │    │  Stavanger         ││
│  │                                             │    │                    ││
│  │                                             │    │  ── KONTAKT ─────  ││
│  │                                             │    │  +47 966 77 888    ││
│  │                                             │    │  henrik.berg@...   ││
│  │                                             │    │  LinkedIn →        ││
│  │                                             │    │                    ││
│  │                                             │    │  ── STATUS ──────  ││
│  │                                             │    │  CV-Epost    ✓     ││
│  │                                             │    │  Innkjøper   ✓     ││
│  │                                             │    │  Ikke relev. ✗     ││
│  │                                             │    │                    ││
│  │                                             │    │  ── TEKNISK DNA ─  ││
│  │                                             │    │  K8s Terraform     ││
│  │                                             │    │  Azure Docker      ││
│  └─────────────────────────────────────────────┘    └────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### Hva er GENUINT annerledes

| Element | Dagens CRM | Ny retning |
|---------|-----------|------------|
| **Layout** | Én kolonne, alt lineært | To-sone: innhold + sidebar |
| **Metadata** | Inline tekst under navn | Key-value par i sidebar |
| **Signal/Status** | Badge + toggles i innholdsstrømmen | Redigerbare felter i sidebar |
| **Highlights** | Ingen | 4 KPI-kort øverst |
| **Navigasjon** | Scroll alt | Fane-basert (Oversikt/Aktivitet/Oppfølginger) |
| **Actions** | Midt i innholdet | Fast i header-baren |
| **Konsulentmatch** | I høyre kolonne (V7) eller bunnen | I hovedinnholdet, fremhevet |

### Visuelt system (ny retning, bryter med project-knowledge)

For Design Lab ignorerer vi project-knowledge sine faste CSS-klasser og bruker:

- **Sidebar**: 280px fast bredde, `#FAFAFA` bakgrunn, key-value rader med label/verdi
- **Highlight-kort**: Hvite med 1px `rgba(0,0,0,0.06)` border, 4 i rad
- **Tabs**: Understrek-stil (ikke fane-kort), 13px medium
- **Actions i header**: Svarte primær-knapper, inline med navnet
- **Key-value sidebar**: Label 11px `#9CA3AF`, verdi 13px `#111827`, vertikalt stablet
- **Generelt**: Ingen skygger, subtile borders, Inter font, tett spacing

### Kontaktlisten

Kontaktlisten (`DesignLabContacts.tsx`) beholder spreadsheet-stilen fra V7 men med oppdatert navigasjon til den nye detaljsiden.

## Filer som endres

1. **`src/pages/DesignLabContactDetail.tsx`** — Fullstendig omskrivning med Attio-inspirert layout: highlight-widgets, tab-basert innhold, persistent sidebar med key-value attributter. Alle dagens data-felter beholdes men reorganiseres.

2. **`src/pages/DesignLabContacts.tsx`** — Mindre justeringer: sikre at klikk navigerer til den nye detaljsiden (ikke sheet).

