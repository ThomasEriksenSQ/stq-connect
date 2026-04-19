

## Mål
Få `/innstillinger` (V2) til å bruke samme bredde-/layoutstrategi som andre V2-flater (ultrawide-vennlig, ingen smal sentrert maxWidth).

## Funn
- `InnstillingerV2` bruker `DesignLabPageShell` med `maxWidth={1180}` — dette tvinger innholdet inn i en smal sentrert kolonne på ultrawide-skjermer (4117px viewport vist på skjermbildet).
- Andre V2-flater (f.eks. `DesignLabContacts`, `DesignLabForesporsler`, `DesignLabKonsulenterAnsatte`) bruker enten `maxWidth={null}` eller ingen maxWidth, slik at innholdet flyter ut til full bredde og utnytter ultrawide.
- Skjermbildet viser tydelig at innstillinger-kortene er klemt sammen i en smal kolonne mens resten av Design Lab strekker seg ut.
- `VarslingsInnstillingerV2` bruker `xl:grid-cols-3` — som er bra, men begrenses av shellets `maxWidth={1180}`.

## Endring

**`src/pages/Innstillinger.tsx`** — `InnstillingerV2`:

1. Bytt `maxWidth={1180}` → `maxWidth={null}` på `DesignLabPageShell` (matcher andre V2-lister).
2. Topp-rad: behold `md:grid-cols-2` for Outlook/Mailchimp, men la kortene flyte i full bredde uten kunstig tak.
3. Sørg for at `VarslingsInnstillingerV2` får utnytte breddene — bekreft at den allerede har `xl:grid-cols-3` (eller juster til `2xl:grid-cols-3` hvis 3-kolonner blir for trangt på mellomstore skjermer).

Ingen endring i V1 eller `VarslingsInnstillinger.tsx`.

## Effekt
- V2 `/innstillinger` får samme ultrawide-oppførsel som resten av Design Lab — kortene strekker seg naturlig ut, ingen smal sentrert kolonne.
- Layout og typografi forblir V2-konform (13px, kort med `C.borderLight`, accent-blå knapper).

## Utenfor scope
- V1-rendring og `VarslingsInnstillinger.tsx`.
- Endringer i `DesignLabPageShell` (det er allerede en støttet `maxWidth={null}`-modus).

