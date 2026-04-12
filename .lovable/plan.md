

## Prioriter mest relevante teknologier i filterchips

### Problem
Teknologifilteret viser de 14 teknologiene med høyest momentum (delta), som ofte gir generiske tags som "Testing" og "CI/CD" i stedet for kjernekompetansene til STACQ.

### Løsning
Endre `technologyOptions` i `src/lib/markedsradar.ts` slik at strategiske teknologier (fra `STRATEGIC_TECHNOLOGIES`) prioriteres først, deretter fyller på med de mest populære trendene.

### Teknisk endring

**Fil:** `src/lib/markedsradar.ts` (linje 411)

Erstatt:
```ts
const technologyOptions = technologyTrends.slice(0, 14).map((item) => item.name);
```

Med logikk som:
1. Filtrer `technologyTrends` til de som finnes i `STRATEGIC_TECHNOLOGIES` og har `current > 0`, sortert etter `current` (høyest først)
2. Fyll på med resterende trender (sortert som før) til maks 14 totalt
3. Dedupliser

Dette sikrer at C++, C, Rust, FPGA, Embedded Linux, Yocto, Zephyr osv. alltid vises først når de har aktive annonser, mens andre populære teknologier fyller resten av plassen.

