

## Mål
Sett radhøyden i **Forespørsler-tabellen** lik den i **Kontakter-tabellen** når raden er "tom" (ingen eller én konsulent), men la flere konsulenter fortsatt utvide raden naturlig.

## Funn
- **Kontakter-rad** (`DesignLabContacts.tsx` linje 2273–2279): `items-center`, `minHeight: 38`, ingen vertikal padding (radens innhold er ett-linjet og har derfor en effektiv høyde på ca. 38 px).
- **Forespørsler-rad** (`DesignLabForesporsler.tsx` linje 538–551): `items-start`, `minHeight: 52`, `paddingTop: 8`, `paddingBottom: 8` (= 16 px ekstra vertikalt). Når det ikke finnes konsulenter blir raden likevel ~52 px høy, klart høyere enn 38 px.
- Konsulent-cellene inni raden bruker `minHeight: 28` per konsulent (linje 615, 659), så raden vokser automatisk når det legges til flere konsulenter — den logikken skal beholdes.

## Endring (én sted)
**`src/pages/DesignLabForesporsler.tsx`** linje 543, 546, 547:
- `minHeight: 52` → `minHeight: 38` (matcher Kontakter)
- `paddingTop: 8` → `paddingTop: 4`
- `paddingBottom: 8` → `paddingBottom: 4`

Reduserer ledig vertikalrom slik at en tom rad lander på ~38 px (samme som Kontakter), men siden hver konsulent-celle har `minHeight: 28` med `gap` mellom seg, vil rader med 2+ konsulenter automatisk vokse — uendret oppførsel der.

Den lille indre paddingen (4 px topp/bunn) beholdes for å unngå at tekst og chip-kanter "klemmes" mot radkantene; Kontakter slipper unna med 0 fordi celleinnholdet er enkle 13 px tekst-elementer, mens Forespørsler-raden inneholder chips (signal, type) som er litt høyere — 4 px gir samme visuelle høyde som Kontakter (≈38 px totalt) uten clipping.

## Effekt
Tomme/én-konsulent-rader på Forespørsler får samme høyde (~38 px) som Kontakter-tabellen. Rader med flere konsulenter utvides naturlig som før.

## Utenfor scope
- Ingen endring i kolonnedefinisjon, header-høyde eller skriftstørrelser.
- Ingen endring i konsulent-cellens `minHeight: 28` (driver vekst ved flere konsulenter).
- V1 `/foresporsler` uendret.

