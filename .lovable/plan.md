

## Forbedre "Selskaper med sterkest signal"-seksjonen

### Problem
Det horisontale stolpediagrammet viser en abstrakt "score" (0-280) som ikke gir brukeren innsikt i *hvorfor* et selskap er rangert høyt. Lange selskapsnavn brytes over flere linjer og blir vanskelige å lese.

### Forslag: Erstatt diagrammet med en rangert liste med visuelle signaler

Fjern Recharts-diagrammet og erstatt med en kompakt, rangert liste der hver rad viser:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 1. AutoStore AS                    23 annonser · 4 denne uken       │
│    ████████████████████████████████████████████░░░░░  (score-bar)    │
│    C++ · FPGA · Embedded Linux        2 kontakter  ·  Ikke i CRM   │
│                                                                      │
│ 2. Kongsberg Discovery (avd Horten)  18 annonser · 2 denne uken    │
│    ██████████████████████████████░░░░░░░░░░░░░░░░░░  (score-bar)    │
│    C++ · RTOS · ARM Cortex-M          1 kontakt   ·  I CRM         │
└──────────────────────────────────────────────────────────────────────┘
```

Hver rad inneholder:
- **Rangeringsnummer** (1-8) for å vise prioritet
- **Selskapsnavn** (klikkbart, navigerer til selskap/opprett)
- **Nøkkeltall**: antall annonser, annonser denne uken
- **Visuell score-bar**: tynn horisontal bar (relativ til høyeste score) som gir visuell sammenligning uten abstrakte tall
- **Teknologier**: topp 3 tech-tags
- **Kontakter + CRM-status**: badges

### Teknisk endring

**Fil:** `src/pages/Markedsradar.tsx` (linje 517-551)

- Fjern `ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis` for denne seksjonen
- Erstatt med en `divide-y divide-border` liste
- Hver rad bruker `flex` layout med en inline CSS-bredde progress-bar (`bg-primary/20 h-1.5 rounded-full`)
- Selskapsnavn er klikkbare og navigerer til riktig side
- Beholder filteredCompanies.slice(0, 8) logikken

