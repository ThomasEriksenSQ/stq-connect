

## Problem (fra skjermbildet)
På 4117px ultrawide ser `/innstillinger` slik ut:
- Kortene er klemt sammen i venstre halvdel av siden — masse tom plass til høyre.
- Outlook + Mailchimp ligger som `md:grid-cols-2` (egen rad).
- Fornyelse + Markedsradar + Salgsagent ligger som `xl:grid-cols-3` (egen rad).
- Resultat: smal kolonne hvor tekst som "Aktiver ukentlig e-postvarsel" og toggle-rader brytes hardt over flere linjer.

`DesignLabPageShell` har allerede `maxWidth={null}` — så det er **innholdsgriddet** som er feil, ikke shellet.

## Årsak
- To separate grid-er (2-kol + 3-kol) gjør at hver rad bare bruker en del av tilgjengelig bredde. Når innholdet er kompakt får vi kolonnebredder under 280px på ultrawide, som forårsaker tekst-wrap.
- `xl:` breakpointen (1280px) er for konservativ for ultrawide — vi får aldri mer enn 3 kolonner.

## Løsning
**Slå sammen alt til ett enkelt responsivt grid** med 5 kort på én rad på ultrawide, gracefully degradering til 1/2/3 kolonner på mindre skjermer.

### Endring i `src/pages/Innstillinger.tsx` — `InnstillingerV2`

1. Fjern den nestede `md:grid-cols-2`-wrapperen rundt Outlook + Mailchimp.
2. Erstatt `<VarslingsInnstillingerV2 />` (som har sin egen 3-kol grid) med en flat-rendret variant — eller flytt grid-styringen opp til `InnstillingerV2`.
3. Bruk `gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"` på en enkelt wrapper rundt alle 5 kortene. Da fyller kortene tilgjengelig bredde naturlig:
   - 4117px → 5+ kolonner (alle på én rad)
   - 1920px → 5 kolonner
   - 1440px → 4 kolonner
   - 1024px → 3 kolonner
   - <768px → 1 kolonne

### Endring i `src/components/VarslingsInnstillingerV2.tsx`
- Fjern `xl:grid-cols-3` og det ytre grid-wrapper'et i `VarslingsInnstillingerV2` — komponenten skal returnere kortene som `<>...</>` (Fragment) slik at parent kan grid'e dem inn i samme `auto-fit`-grid som Outlook og Mailchimp.
- Alternativt: ekspose en `<VarslingsInnstillingerV2Cards />`-helper som rendrer kun kortene uten grid.

### Bonus-finpuss
- Sett `alignItems: "start"` på grid'et så kortene ikke strekkes til høyeste kort (ujevne høyder ser ryddigere ut i tett grid).
- Behold `gap: 16` for visuell rytme.

## Effekt
- På 4117px ultrawide: alle 5 kortene ligger pent på én rad, ingen tekst-wrap, bredden utnyttes.
- På midtre bredder: grid faller naturlig ned til 4/3/2 kolonner uten ekstra breakpoints.
- Mobil: 1 kolonne.

## Utenfor scope
- V1 `/innstillinger` (urørt).
- Endringer i `VarslingsInnstillinger.tsx` (V1-versjon urørt).
- Endring av kort-innhold, knapper eller felt-typografi.

