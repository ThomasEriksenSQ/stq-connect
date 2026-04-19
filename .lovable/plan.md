
## Mål
Få header-raden i høyre kalender/tidslinje til å matche venstre tabell visuelt, ikke bare “ca.”.

## Hva som er galt nå
Jeg sjekket koden mot skjermbildet:
- Venstre header i `KonsulenterOppdrag.tsx` bruker `px-4 py-2.5 border-b` og får dermed en kompakt, naturlig høyde.
- Høyre header i `FornyelsesTimeline.tsx` er låst til `h-[41px]`.
- Det er derfor høyre header fortsatt blir høyere enn venstre, akkurat som du ser visuelt.

## Plan
1. Bruk venstre tabell-header som fasit
   - Matche samme vertikale oppskrift som venstre side i split view:
   - samme topp/bunn-padding
   - samme border/header-struktur
   - samme innholdsjustering

2. Fjerne hardkodet høyde i `src/components/FornyelsesTimeline.tsx`
   - Bytte ut `h-[41px]` på header-wrapperen.
   - La headeren få høyde fra samme padding-basert layout som venstre tabell, i stedet for fast pikselhøyde.

3. Matche cellene inni headeren
   - Gi både `Konsulent`-cellen og månedscellene samme vertikale spacing og sentrering som venstre header.
   - Beholde dagens font/farge, men sørge for at underline på aktiv måned ikke påvirker total høyde.

4. Finjustere sticky/header-laget
   - Sikre at sticky header fortsatt fungerer uten å introdusere ekstra høyde via absolute-elementer eller bakgrunnslag.

## Forventet resultat
- Header-raden på høyre side blir like høy som venstre tabell-header.
- Teksten havner på samme vertikale nivå.
- Aktiv måned-markering vises fortsatt, men uten å “strekke” headeren.

## Teknisk detalj
Kilden til mismatchen er sannsynligvis denne forskjellen:
```tsx
// Venstre
className="grid gap-3 px-4 py-2.5 border-b ..."

// Høyre nå
className="flex border-b ... h-[41px]"
```

Ved implementasjon vil jeg gjøre høyre header padding-basert som venstre, i stedet for høyde-basert.
