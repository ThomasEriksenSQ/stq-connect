

## Fiks sortering: bruk daysUntilForny i stedet for forny_dato

### Problem
Sorteringslogikken (linje 174-176) bruker `a.forny_dato` direkte for å sortere. For oppdrag med "Løpende 30 dager" er `forny_dato` null, så den effektive fornyelsesdatoen (30 dager frem) brukes ikke. I stedet må vi bruke det allerede beregnede `daysUntilForny`-feltet som korrekt håndterer både vanlige og løpende oppdrag.

### Endring

**Fil: `src/pages/KonsulenterOppdrag.tsx`, linje 173-176**

Erstatt `forny_dato`-sorteringen med `daysUntilForny`:

```typescript
// Begge er aktive/oppstart — sorter etter dager igjen
const af = a.daysUntilForny ?? 9999;
const bf = b.daysUntilForny ?? 9999;
return af - bf;
```

Dette sikrer at et "Løpende 30 dager"-oppdrag (daysUntilForny = 30) sorteres etter et oppdrag med 10 dager igjen, som forventet.

