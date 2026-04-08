

## Plan: Fikse lagring på ansattdetalj-siden

### Problem
`AnsattDetailSheet.handleSave` invaliderer kun `["stacq-ansatte"]` (listenøkkelen), men `AnsattDetail.tsx` bruker `["ansatt-detail", ansattId]` som query key. Etter lagring henter derfor detaljsiden aldri oppdaterte data.

### Løsning i `src/components/AnsattDetailSheet.tsx`

Legg til invalidering av detaljnøkkelen etter lagring (linje 265):

```ts
queryClient.invalidateQueries({ queryKey: ["stacq-ansatte"] });
queryClient.invalidateQueries({ queryKey: ["ansatt-detail", ansatt?.id] });
```

### Kun én fil endres
- `src/components/AnsattDetailSheet.tsx`

