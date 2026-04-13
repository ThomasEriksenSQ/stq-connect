

## Sorter aktive oppdrag etter fornyelsesdato

### Problem
Linje 168-171 prioriterer statusgruppe (Oppstart → Aktiv → Inaktiv) før dato. Et Oppstart-oppdrag med 30 dager igjen vises over et Aktiv-oppdrag med 10 dager igjen.

### Endring

**Fil: `src/pages/KonsulenterOppdrag.tsx`, linje 167-179**

Slå sammen Oppstart og Aktiv til én gruppe og sorter alle etter `daysUntilForny` stigende (lavest først). Null-verdier (ingen fornyelsesdato) sorteres sist. Inaktive oppdrag legges til slutt.

```typescript
return [...items].sort((a: any, b: any) => {
  const aActive = a.status === "Aktiv" || a.status === "Oppstart";
  const bActive = b.status === "Aktiv" || b.status === "Oppstart";
  if (aActive && !bActive) return -1;
  if (!aActive && bActive) return 1;
  if (!aActive && !bActive) return (b.slutt_dato || "").localeCompare(a.slutt_dato || "");
  // Begge er aktive/oppstart — sorter etter fornyelsesdato
  const af = a.forny_dato || "9999";
  const bf = b.forny_dato || "9999";
  return af.localeCompare(bf);
});
```

