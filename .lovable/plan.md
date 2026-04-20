

## Plan: Skill mellom ansettelses-start og oppdragstilgjengelighet

### Diagnose

I `src/pages/DesignLabKonsulenterAnsatte.tsx`:

- `getStatus` (linje 128–133) markerer en ansatt som **"Kommende"** hvis enten `start_dato` ELLER `tilgjengelig_fra` ligger frem i tid.
- `getUpcomingDate` (linje 135) returnerer `tilgjengelig_fra` først, så `start_dato`.
- Start-kolonnen (linje 312–324) viser `Starter {upcomingDate}` når status er "Kommende".

Resultatet for Tom Erik: han startet i 2006, men har `tilgjengelig_fra = 2026-04-24` (fordi han er i oppdrag som slutter da). Systemet feilklassifiserer ham som "Kommende ansatt" og viser "Starter 24.04" i Start-kolonnen — selv om han er en aktiv ansatt med 19 års fartstid.

Dette skjer i `DesignLabKonsulenterAnsatte.tsx`. V1-versjonen (`KonsulenterAnsatte.tsx` linje 100–104) har riktig logikk — kun `start_dato` styrer "Kommende".

### Endring

Fil: `src/pages/DesignLabKonsulenterAnsatte.tsx`

**1. `getStatus` (linje 128–133)** — fjern `tilgjengelig_fra`-grenen:
```ts
const getStatus = (row: any) => {
  if (row.status === "SLUTTET") return "Sluttet";
  if (row.start_dato && isAfter(new Date(row.start_dato), today)) return "Kommende";
  return "Aktiv";
};
```

**2. `getUpcomingDate` (linje 135)** — bruk kun `start_dato` for "Kommende"-chip i Start-kolonnen, eller fjern funksjonen helt og forenkle render. Behold den hvis den brukes andre steder (sjekkes), ellers inline:
```ts
// Start-kolonnen blir:
{status === "Kommende" && row.start_dato ? (
  <DesignLabReadonlyChip active activeColors={UPCOMING_CHIP_COLORS}>
    Starter {format(new Date(row.start_dato), "dd.MM")}
  </DesignLabReadonlyChip>
) : (
  row.start_dato ? format(new Date(row.start_dato), "dd.MM.yyyy") : "–"
)}
```

### Konsekvens

- Tom Erik vises nå som "Aktiv" med `01.??.2006` i Start-kolonnen og "19 år" i Ansettelse — korrekt.
- Kun reelt nye ansatte (med fremtidig `start_dato`) markeres som "Kommende" og får "Starter dd.MM"-chippen.
- `tilgjengelig_fra` brukes ingen steder i denne tabellen lenger — det er en oppdrags-egenskap, ikke en ansettelses-egenskap.

### Ikke endret

- V1 `KonsulenterAnsatte.tsx` — har allerede riktig logikk.
- Filtre, sortering, øvrige kolonner.
- "Tilgjengelig for oppdrag"-baren på andre sider som faktisk bruker `tilgjengelig_fra` til riktig formål.

