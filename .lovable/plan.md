

## Mål
Den horisontale streken som i dag kun går over venstre kolonne (over "Aktiviteter") skal i stedet gå tvers over hele selskapskortet — under header-blokken med navn/org.nr/sted og over hele to-kolonne-innholdet (Aktiviteter + Kontakter).

## Funn
- I `src/components/CompanyCardContent.tsx`:
  - Streken ligger på linje **1012** som `<div className="border-t border-border/50" />`, plassert **inne i** `companyDetailSections` (linje 792). Denne blokken rendres kun i venstre `ResizablePanel` (linje 2098), derfor stopper streken før Kontakter-kolonnen.
  - Headeren (navn + org.nr/sted/lenker) avsluttes på linje **2005**.
  - Snapshot-rad (2082–2088) returnerer `null` i praksis (ingen visuell effekt).
  - Notat-blokken (2007–2080) vises kun når `showNotes` er true.
  - To-kolonne-rutenettet starter på linje 2090 (`md:hidden`) og 2095 (`hidden md:block`).

## Plan

1. **Fjern den eksisterende streken inne i `companyDetailSections`** (linje 1012) — den hører ikke hjemme i venstre kolonne lenger.

2. **Legg inn en full-bredde strek rett etter headeren** (etter linje 2005, før notat-blokken):
   ```tsx
   <div className="border-t border-border/50 mb-5" />
   ```
   - Plasseres som søsken til header-`<div>`-en, så den spenner hele kortets bredde (over både venstre detalj-kolonne og høyre kontakter-kolonne).
   - `mb-5` matcher den eksisterende `space-y-5`-rytmen i `companyDetailSections` slik at avstanden ned til Aktiviteter/Kontakter blir uendret.
   - Notat-blokken (når synlig) får da streken over seg, som er korrekt — alt under headeren skal være visuelt adskilt.

3. **Ingen andre endringer**: ingen layout-, padding- eller fargeendringer. Streken bruker samme `border-border/50`-token som før.

## Filer som endres
- `src/components/CompanyCardContent.tsx` — flytt én strek fra linje 1012 til etter headeren (etter linje 2005).

## Utenfor scope
- Endring av header-layout, notat-blokk, snapshot eller to-kolonne-rutenettet.
- Andre flater enn selskapskortet.

