

## Fiks: "Løpende 30 dager"-oppdrag viser feil dato i kalendertidslinje

### Problem
I `FornyelsesTimeline.tsx` linje 64 filtreres oppdrag med `o.forny_dato` — men for "Løpende 30 dager"-oppdrag skal fornyelsesdatoen beregnes som **dagens dato + 30 dager**, ikke leses fra `forny_dato`-feltet. Christian har `lopende_30_dager = true` med en gammel `forny_dato` (21. april), så kalenderen viser feil dag.

### Endring

**Fil: `src/components/FornyelsesTimeline.tsx`, linje 62-82**

Oppdater `rows`-beregningen:
1. Endre filteret (linje 64) til å inkludere oppdrag som har enten `forny_dato` eller `lopende_30_dager`
2. Beregn effektiv dato (linje 66) som `new Date(Date.now() + 30*86400000)` for løpende oppdrag, ellers `new Date(o.forny_dato)`

```typescript
const rows = useMemo(() => {
  const now = new Date();
  return enriched
    .filter((o: any) => (o.status === "Aktiv" || o.status === "Oppstart") && (o.forny_dato || o.lopende_30_dager))
    .map((o: any) => {
      const d = o.lopende_30_dager
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(o.forny_dato);
      return {
        id: o.id,
        navn: o.kandidat || "?",
        fullName: o.kandidat || "?",
        kunde: o.kunde || "",
        utpris: Number(o.utpris) || 0,
        status: o.status,
        erAnsatt: o.er_ansatt === true,
        fornyDate: d,
        fornyMonth: d.getFullYear() === year ? d.getMonth() : -1,
        fornyDay: d.getDate(),
        fullDate: format(d, "d. MMMM yyyy", { locale: nb }),
      };
    })
    .sort((a, b) => a.fornyDate.getTime() - b.fornyDate.getTime());
}, [enriched, year]);
```

Dette sikrer at Christian (og andre med "Løpende 30 dager") vises med riktig dato — i dag 13. mai (13. april + 30 dager).

