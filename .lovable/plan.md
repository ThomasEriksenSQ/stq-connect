

## Plan: Signal-velger som horisontale chips

### Problem
Signal-velgeren i Salgssenteret (DailyBrief) er en dropdown-meny. Brukeren vil ha de fem signalvalgene som horisontale chips på rad — samme stil som «Innkjøper» og «CV-epost».

### Endring

**Fil:** `src/components/dashboard/DailyBrief.tsx` (linje 1078–1135)

Erstatt hele dropdown-konstruksjonen (relativ div, trigger-knapp med ChevronDown, absolutt posisjonert panel) med fem individuelle knapper i samme `flex-wrap` container:

- Hver knapp bruker samme klasser som Innkjøper/CV-epost: `inline-flex items-center h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors`
- **Valgt signal:** Viser kategoriens `badgeColor` (emerald for "Behov nå", blue for "Får fremtidig behov", osv.)
- **Ikke valgt:** `bg-background text-muted-foreground border-border hover:bg-secondary`
- Rekkefølge: Behov nå → Får fremtidig behov → Får kanskje behov → Ukjent om behov → Ikke aktuelt
- Klikk på allerede valgt signal fjerner signalet (setter til tom)
- Klikk på ny signal kjører samme `persistSignalToFollowUp`-logikk som dropdown-versjonen
- Fjerner `ChevronDown`-ikonet og den absolutte dropdown-panelen helt
- `activeForm === "signal"` state brukes ikke lenger for dette

