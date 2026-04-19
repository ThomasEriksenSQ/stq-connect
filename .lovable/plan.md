

## Mål
Harmoniser radhøyder og typografi i fire V2-tabeller (STACQ Prisen, Aktive oppdrag, Ansatte, Eksterne) til samme uttrykk som Kontakter-tabellen (`minHeight: 38`, 13px tekst). Fiks også at TEKNOLOGIER-kolonnen i Eksterne kan flyte over i flere rader.

## Referanse: Kontakter-tabellen (`DesignLabContacts.tsx` linje 2270–2290)
- `minHeight: 38`
- Navn: `fontSize: 13, fontWeight: 500`
- Selskap/sekundær: `fontSize: 12–13, color: C.textMuted`
- Ingen avatar i raden

## Endringer

### 1. `src/pages/DesignLabStacqPrisen.tsx`
- Datarad (linje 289): `minHeight: 40` → `minHeight: 38`.
- TOTAL-rad (linje 339): `minHeight: 40` → `minHeight: 38`.
- Avatar (20×20) beholdes — passer fortsatt i 38px.

### 2. `src/pages/KonsulenterOppdrag.tsx` (kun V2-grenen, `embeddedSplit === true`)
Linje 418–525 (embeddedSplit-grenen):
- Rad: `min-h-[44px] py-2` → `min-h-[38px] py-1`.
- Avatar: `w-7 h-7` → `w-6 h-6`, `text-[0.625rem]` beholdes.
- Konsulent-navn (linje 454): `text-[0.875rem] font-semibold` → `text-[0.8125rem] font-medium` (matcher Kontakter).
- Kunde (linje 456): `text-[0.875rem] font-medium text-foreground` → `text-[0.8125rem] text-muted-foreground` (matcher Kontakter "Selskap"-kolonne, dempet).
- V1-grenen (linje 569+, ikke-embeddedSplit) er **urørt**.

### 3. `src/pages/DesignLabKonsulenterAnsatte.tsx`
- Rad (linje 266): `minHeight: 44` → `minHeight: 38`.
- Avatar (linje 281, 283–288): `h-8 w-8` → `h-6 w-6`, initialer `fontSize: 11` → `fontSize: 10`.
- Tekstgap `gap-3` → `gap-2`.

### 4. `src/pages/EksterneKonsulenter.tsx` (kun V2-grenen, `embeddedSplit === true`)
Linje 256–289 (embeddedSplit-grenen):
- Rad (linje 262): `min-h-[44px] py-2` → `min-h-[38px] py-1`.
- TEKNOLOGIER-kolonne (linje 280): erstatt `flex flex-wrap` med `flex flex-nowrap overflow-hidden items-center`. Reduser fra `slice(0, 3)` → `slice(0, 2)` for å sikre at to tagger + "+N" alltid får plass på én linje uten wrap. Vis "+N" når det finnes flere enn 2.
- V1-grenen (linje 326+, ikke-embeddedSplit) er **urørt**.

## Effekt
- Alle fire V2-tabeller får 38px radhøyde — visuell rytme matcher Kontakter.
- Aktive oppdrag bruker 13px / dempet farge på Kunde-kolonnen, identisk med Kontakter sin Selskap-kolonne.
- TEKNOLOGIER i Eksterne forblir én linje med "+N"-overflow.
- V1-flatene `/aktive-oppdrag` og `/eksterne` (ikke-embeddedSplit) er bit-for-bit urørt.

## Utenfor scope
- V1-rendring i `KonsulenterOppdrag` og `EksterneKonsulenter`.
- Endring av kolonnebredder eller grid-templates.
- Endring av sortering/filter/data-logikk.

