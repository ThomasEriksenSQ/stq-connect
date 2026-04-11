

## Plan: Legg til "Vis/Skjul e-post"-toggle i aktivitetstidslinjen

### Hva skal bygges
En toggle-knapp til høyre for "AKTIVITETER · N"-overskriften som lar brukeren veksle mellom å vise eller skjule Outlook-e-poster i tidslinjen.

### Design
- Plasseres på samme linje som "AKTIVITETER · N", høyrejustert
- Tekst: "Skjul e-post" (når e-post vises) / "Vis e-post" (når e-post er skjult)
- Liten knapp med Mail-ikon, styling: `text-[0.75rem] text-muted-foreground hover:text-foreground`
- Antallet i "AKTIVITETER · N" oppdateres dynamisk basert på filteret

### Teknisk endring
**Fil: `src/components/ContactCardContent.tsx`** — i `ActivityTimeline`-komponenten:

1. Legg til `useState<boolean>(true)` for `showEmails`
2. Filtrer `mergedItems` basert på toggle: når `showEmails` er false, ekskluder items med `_source === "email"`
3. Oppdater `totalCount` og `grouped` til å bruke filtrerte items
4. Legg til toggle-knapp i headeren ved siden av "AKTIVITETER · N"

