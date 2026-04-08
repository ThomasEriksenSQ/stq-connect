

## Plan: Gjør OppdragRow mobilvennlig

Problemet er at `OppdragRow` bruker `flex items-center gap-4` horisontalt, som presser kundenavn, dato, priser og badge på én rad — det bryter på smale skjermer (390px).

### Endring i `src/pages/AnsattDetail.tsx` — `OppdragRow`-komponenten

Endre layout fra én horisontal rad til en stabelbar layout på mobil:

1. **Ytre container**: Bytt fra `flex items-center` til `flex flex-col sm:flex-row sm:items-center`
2. **Kundenavn + dato**: Beholdes som `flex-1 min-w-0`, men dato flyttes til egen linje under kundenavn på mobil (fjern `ml-2`, bruk `block`)
3. **Priser-rad**: Wrap i `flex flex-wrap gap-x-4 gap-y-1` slik at prisene brytes pent
4. **Status-badge**: Plasseres øverst til høyre på mobil via `sm:ml-auto` eller i flyten

Resultatet blir at kortet stables vertikalt på mobil: kundenavn → dato → priser → status.

