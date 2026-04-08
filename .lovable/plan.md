

## Plan: Vis fulle navn og fjern kundenavn i fornyelsestidslinjen

### Endringer i `src/components/FornyelsesTimeline.tsx`

1. **Linje 69**: Endre `navn` fra `o.kandidat?.split(" ")[0]` til `o.kandidat || "?"` (fullt navn i stedet for fornavn)
2. **Linje 120–121** (venstrekolonnen): Fjern `<p>` med `r.kunde` — vis kun navnet
3. **Tooltip** (ca. linje 155): Oppdater tooltip til å ikke vise `r.navn — r.kunde` men bare `r.fullName` siden kunde fjernes fra visningen

Kun én fil endres.

