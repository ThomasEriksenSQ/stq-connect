

## Mål
Match høyden på header-raden i kalender-tidslinjen (høyre) med header-raden i hovedtabellen (venstre) på `/design-lab/aktive-oppdrag`.

## Funn
- Venstre tabell-header bruker Design Lab-standard via `DesignLabColumnHeader` rendret i en `<thead>` — sannsynligvis ~36–40px høy med standard cell-padding fra V2-tabell.
- Høyre header i `FornyelsesTimeline.tsx` (linje ~120): `py-2.5` (10px topp/bunn) + 11px font ≈ 30–32px total høyde. **For lav.**
- Skjermbilde bekrefter at høyre header sitter høyere/tynnere enn venstre.

## Plan
Finn eksakt header-høyde i venstre tabell ved å lese `DesignLabKonsulenterOppdrag.tsx` (eller hvor venstre tabell rendres på `/design-lab/aktive-oppdrag`), og sett samme min-høyde på header-raden i `FornyelsesTimeline.tsx`.

Endring i `src/components/FornyelsesTimeline.tsx`:
- På header-wrapperen (`<div className="flex border-b border-border ...">`): legg til `min-h-[Xpx]` matchende venstre.
- Endre `py-2.5` → bruk flex-align så innhold sentreres vertikalt i den nye høyden.
- Samme behandling for både "Konsulent"-cellen og månedscellene.

Anslått høyde: 40px (matcher V2 tabellrad-standard ~30–34px + header har ofte litt mer luft, men må verifiseres mot venstre i implementasjon).

## Effekt
Header-raden i kalenderen får identisk høyde som tabell-headeren til venstre. Begge ligger på samme baseline.

## Utenfor scope
- Andre rader (allerede matchet i tidligere oppgave).
- Kolonnebredder, font, farge.

