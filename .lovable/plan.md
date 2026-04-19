
## Problem
1. I expanded modus vises collapse-knappen kun på hover øverst i logo-raden — for skjult/utilgjengelig.
2. I collapsed modus er knappen plassert absolutt under logoen, men brukeren rapporterer at det "ikke finnes måte å ekspandere på" — sannsynligvis er den ikke synlig nok eller treffer ikke der man forventer.

## Funn
`src/components/designlab/DesignLabSidebar.tsx` har nå en liten `PanelLeft`-knapp i logo-raden med `opacity-0 group-hover:opacity-100` i expanded modus, og absolutt-posisjonert under logoen i collapsed modus. Begge plasseringer er suboptimale: hover-only er for skjult, og absolutt-posisjonering under logoen er uforutsigbar.

## Forslag — flytte toggle til footer som permanent ikon-knapp
Linear, Notion, Height og Höst plasserer collapse-toggle nederst til høyre i sidebaren — alltid synlig, ikke hover-avhengig, og ikke i veien for innhold. Dette er det mest etablerte mønsteret.

### Konkret plan
1. **Fjerne** den nåværende toggle-knappen fra logo-raden (både hover-versjonen og absolutt-versjonen).
2. **Legge til** en kompakt ikon-knapp nederst i sidebar-footeren — på samme rad som "Innstillinger"/avatar, høyrejustert:
   - Expanded modus: liten 24×24 ikon-knapp helt til høyre i footer-raden, ved siden av brukeravatar/innstillinger. Ikon `PanelLeftClose` (lucide) — viser tydelig at sidebaren lukkes mot venstre.
   - Collapsed modus: full-bredde ikon-knapp sentrert (samme stil som de andre ikonene i collapsed sidebar). Ikon `PanelLeftOpen` — viser at sidebaren åpnes.
3. **Alltid synlig** — ingen hover-trigger. Bruker `C.textFaint` default, `C.text` på hover, hover-bg `C.hoverSubtle`.
4. **Tooltip** via `title`-attributt: "Skjul sidebar" / "Utvid sidebar".
5. **Tastatursnarvei** (bonus, lavt risikonivå): `Cmd/Ctrl + \` for å toggle — standard Linear/VSCode-snarvei. Legges som global `useEffect` i sidebaren.

### Visuelt resultat
```
Expanded:                          Collapsed:
┌──────────────────────────┐       ┌────┐
│ [STACQ logo]             │       │ ▣  │
│                          │       │    │
│ CRM                      │       │ ▣  │
│  Salgsagent              │       │ ▣  │
│  Selskaper               │       │ ▣  │
│  ...                     │       │ ▣  │
│                          │       │    │
├──────────────────────────┤       ├────┤
│ Innstillinger      [‹‹]  │       │ ⚙  │
│ [avatar] Jon R.          │       │ ›› │
└──────────────────────────┘       └────┘
```

Toggle ligger som siste element i footer-raden (expanded) eller som egen rad (collapsed) — alltid synlig, forutsigbart sted.

### Filer som endres
- `src/components/designlab/DesignLabSidebar.tsx` — fjerne toggle fra logo-rad, legge til i footer-blokken; legge til Cmd+\\ keyboard-listener.

## Effekt
- Toggle alltid synlig — ingen hover-mysterier.
- Forutsigbar plassering nederst (Linear/Notion-mønster).
- Cmd+\\ gir power-user tastatursnarvei.
- Logo-raden blir ren og minimalistisk igjen.

## Utenfor scope
- Endre selve sidebar-animasjon eller bredde.
- Endre footer-knappene (Innstillinger, Logg ut, avatar) utover å legge til toggle som siste element.
