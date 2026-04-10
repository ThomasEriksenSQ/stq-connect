

## Plan: Erstatt "Hot list"-knappen med "Alle" og fjern den gamle "Alle"-chippen

### Hva endres

I Signal-filterraden på kontaktlisten:
- **Fjern** den separate "Alle"-chippen (linje 1322)
- **Fjern** den vertikale skillelinjen (linje 1326)
- **Flytt** Hot list-knappen til plassen der "Alle" var — som første element i raden
- **Endre utseende**: Knappen skal se ut som den nåværende "Alle"-chippen (samme stil som andre chips når aktiv/inaktiv), med label "Alle"
- **Behold all logikk**: Toggle-funksjonaliteten for `hotListActive` beholdes, men knappen fungerer nå som "Alle"-filteret og aktiverer/deaktiverer prioriteringssortering som før

### Teknisk detalj

**Fil**: `src/pages/Contacts.tsx`

Erstatt linje 1322–1341 med én enkelt knapp:
```tsx
<button
  onClick={() => {
    setSignalFilter("all");
    const next = !hotListActive;
    setHotListActive(next);
    setSort(next ? { field: "priority", dir: "desc" } : { field: "signal", dir: "asc" });
  }}
  className={cn(
    "h-8 px-3 text-[0.8125rem] rounded-full border transition-colors",
    signalFilter === "all"
      ? "bg-foreground text-background border-foreground font-medium"
      : "border-border text-muted-foreground hover:bg-secondary",
  )}
>
  Alle
</button>
```

Når bruker klikker et signal-filter (f.eks. "Behov nå"), forblir `hotListActive` uendret. Når bruker klikker "Alle", settes `signalFilter` til "all" og prioriteringssortering aktiveres.

`hotListActive` forblir `true` som default, slik at temperatur-indikatorer og ⚠-ikoner vises som normalt.

