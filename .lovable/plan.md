

## Mål
Vis profilbilde (eller initialer) foran konsulentnavnet i tabellen på `/design-lab/stacq-prisen`, slik at den matcher visuell stil fra `FornyelsesTimeline` og andre V2-flater.

## Funn
- `DesignLabStacqPrisen.tsx` har en rad-grid på linje 246–280 hvor første kolonne kun viser `row.kandidat` som tekst.
- Hver `row` har allerede `er_ansatt` og `kandidat` (fullt navn). Det finnes ingen direkte `ansatt_id` på `stacq_oppdrag`-rader, så vi må mappe navn → `ansatt_id` → `portrait_url`, akkurat som `FornyelsesTimeline.tsx` gjør (linje 31–60).
- Eksterne konsulenter (`er_ansatt === false`) har ikke portrett — de skal vise dempet initialavatar.
- `getInitials` finnes i `@/lib/utils` (brukt i `FornyelsesTimeline`).

## Endring

**`src/pages/DesignLabStacqPrisen.tsx`**

1. Legg til to ekstra `useQuery`-kall (parallelt med eksisterende), identisk med `FornyelsesTimeline`:
   - `stacq_ansatte` → `id, navn` (for navn→id-map).
   - `cv_documents` → `ansatt_id, portrait_url` filtrert `not null`.
2. Bygg to maps i `useMemo`: `nameToAnsattId` og `portraitByAnsattId`.
3. Importer `getInitials` fra `@/lib/utils`.
4. I rad-renderen (linje 250–278): erstatt den enkle `<span>{row.kandidat}</span>` med en flex-container:
   - **Hvis ansatt + portrett finnes:** `<img>` 20x20px, rounded-full, `object-cover`, 1px `C.borderLight`-ramme.
   - **Hvis ansatt uten portrett:** sirkel 20x20px med `C.accentBg` bakgrunn, `C.accent` tekst, initialer 9px/600.
   - **Hvis ekstern:** sirkel 20x20px med `C.surfaceAlt` bakgrunn, `C.textMuted` tekst, initialer 9px/600.
   - Etterfulgt av navnet uendret (13px/500/`C.text`).
5. På "TOTAL"-raden (linje 282–295): la første kolonne fortsatt vise "TOTAL" uten avatar (samme indent — bruk en transparent 20px-spacer for å holde tekstjustering konsistent med radene over).

Avatar-størrelse 20px valgt fordi rad-`minHeight` er 40px — gir tett, Linear-aktig uttrykk uten å forstyrre eksisterende grid-kolonnebredder.

## Effekt
- Konsulentkolonnen viser portrett/initialer foran navnet — matcher FornyelsesTimeline-mønsteret og gir umiddelbar visuell gjenkjenning.
- Ingen layout-shift: avatar er 20px, navn beholder samme posisjon med 8px gap.
- TOTAL-raden forblir tekstjustert med konsulentnavnene over.

## Utenfor scope
- V1 `/stacq-prisen` (ingen V1-versjon påvirkes).
- Endringer i datamodell eller `stacq_oppdrag`-skjema.
- Avatar i edit-modalen.

