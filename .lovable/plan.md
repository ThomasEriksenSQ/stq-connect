
## Mål
Gjør "CV-editor"-knappen i headeren på ansattprofilen blå (samme primær-stil som "Finn oppdrag"), så de to viktigste handlingene står likt fremhevet.

## Funn
- Knappene ligger i headeren i `src/pages/AnsattDetail.tsx`.
- "Finn oppdrag" bruker primær blå stil (accent/primary).
- "CV-editor" bruker i dag outline/secondary stil (hvit bg, border, mørk tekst) — derfor ser den dempet ut ved siden av.
- Per memory `employee-profile-actions` er rekkefølgen: CV-editor → Finn oppdrag → Rediger. Rekkefølge beholdes.

## Plan
1. Finn "CV-editor"-knappen i `src/pages/AnsattDetail.tsx`.
2. Endre variant/styling til samme primære blå stil som "Finn oppdrag" (samme `Button`-variant eller samme klassesett — blå bakgrunn, hvit tekst, samme høyde og radius).
3. Behold ikon (ekstern lenke) og label "CV-editor" — kun farge endres.

## Effekt
- Begge primærhandlinger (CV-editor + Finn oppdrag) vises blå side om side.
- "Rediger" forblir outline/sekundær, så hierarkiet er fortsatt lesbart.

## Utenfor scope
- Endring av rekkefølge, ikoner eller andre knapper.
- Endringer på V2/Design Lab-spesifikke flater utover det som arves fra `AnsattDetail`.
