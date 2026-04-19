
## Mål
"Vis mer"-knappen under KOMPETANSE-seksjonen på ansattprofilen ligger for tett opp til chip-raden, og kutter visuelt bunnen av chipsene. Øk avstanden noen piksler.

## Funn
- Ruten er på `/design-lab/ansatte/4` (V2-flate).
- Trolig brukes et felles `kompetanse`/tag-grid med en collapsed/expand-knapp ("Vis mer" / "Vis færre").
- Må finne komponenten som rendrer KOMPETANSE-blokken på ansattdetalj — sannsynligvis i `src/pages/AnsattDetail.tsx` (delt mellom V1 og V2 via `embedded`-prop) eller en dedikert seksjon.

## Plan
1. Lokaliser "Vis mer"-knappen for KOMPETANSE i `src/pages/AnsattDetail.tsx` (eller komponenten den bruker).
2. Øk topp-margin på knappen fra nåværende verdi (sannsynligvis `mt-1`/`mt-2`) til `mt-3` (≈12px), slik at chipsene ikke ser kuttet ut.
3. Behold all øvrig styling, font og farge (lenkeblå "Vis mer").

## Effekt
- Liten, men merkbar luft mellom siste chip-rad og "Vis mer"-lenken — chipsene "puster" og bunnen kuttes ikke visuelt.

## Utenfor scope
- Endring av chip-stil, font eller farger.
- Endringer på andre sider som bruker samme komponent (samme spacing fungerer der også).
