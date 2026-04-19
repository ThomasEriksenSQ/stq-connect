

## Mål
Få radhøyden i kalendervisningen (`FornyelsesTimeline`) til å matche den venstre "Aktive oppdrag"-tabellen (38px), og redusere headeren tilsvarende slik at totalproporsjonen stemmer.

## Funn
- Venstre tabell på `/design-lab/aktive-oppdrag` (V2/`embeddedSplit`-grenen i `KonsulenterOppdrag.tsx`) bruker `min-h-[38px] py-1`.
- `FornyelsesTimeline.tsx` bruker `py-2.5` på radene (~44px effektiv høyde) og `py-2` på headeren — derfor blir kalenderens rader merkbart høyere enn tabellraden ved siden av.
- Avatar i timeline er allerede 24px (`w-6 h-6`), så den passer fint i en 38px rad.

## Endringer i `src/components/FornyelsesTimeline.tsx`

1. **Header (linje 105–123)**
   - Erstatt `py-2` med `py-1` på både den tomme venstre-cellen (linje 106) og månedscellene (linje 111).
   - Beholder `text-[0.6875rem] font-medium uppercase` og current-month underline.

2. **Rader (linje 132–183)**
   - Wrapper-rad (linje 132): legg til `min-h-[38px]`.
   - Venstre navne-celle (linje 133): `py-2.5` → `py-1`.
   - Måneds-celler (linje 159): `py-2.5` → `py-1`.
   - Pillen som viser dato (linje 168) beholdes `h-6` — passer i 38px.

3. **Ingen endring** i:
   - V1-bruken av `FornyelsesTimeline` (komponenten er felles, men høyden 38 matcher også V1-tabellraden ok; visuelt strammere uten å bryte noe).
   - Sticky header / sticky venstre-kolonne.
   - Summary-footer.

## Effekt
- Kalenderradene blir 38px — samme som tabellradene til venstre, slik at radene aligner perfekt på tvers av panel-skillet.
- Headerraden blir noe lavere og matcher tabellens header-rytme.
- Ingen layoutshift i avatar/pille (begge 24px).

## Utenfor scope
- V1-spesifikke layoutendringer.
- Fargene/pille-stilen i kalenderen.
- Endring av kolonnebredder eller månedsbredder.

