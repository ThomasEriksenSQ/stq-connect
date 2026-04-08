

## Plan: Legg til tilbake-knapp i Finn oppdrag-overlayen

### Endring i `src/components/AnsattDetailSheet.tsx`

Legg til en "Tilbake"-knapp øverst i content-området når `activeMode` er `"oppdrag"` eller `"leads"`. Knappen resetter `activeMode` til `null` slik at brukeren kan velge på nytt.

- Legg til en `<button>` med `ArrowLeft`-ikon og teksten "Tilbake" rett over innholdet i begge modusene (linje 689 og 705)
- `onClick` setter `setActiveMode(null)` (og `setFinnLeads(false)` for leads-modusen)
- Stil: `inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground hover:text-foreground mb-3`

### Kun én fil endres
- `src/components/AnsattDetailSheet.tsx`

