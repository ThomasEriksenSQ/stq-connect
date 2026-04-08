
## Plan: Tre-kolonners info-grid

Endrer info-grid i `src/pages/AnsattDetail.tsx` fra `grid-cols-2` til `grid-cols-3` for bedre utnyttelse av bredden.

### Endring
- `grid grid-cols-1 sm:grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Rekkefølge optimalisert for 3 kolonner (8 felter = 3+3+2 rader):

```text
Rad 1:  E-post          | Telefon        | Geografi
Rad 2:  Startdato       | Sluttdato      | Tilgjengelig fra
Rad 3:  Års erfaring    | Ansatt i       | (tom)
```

### Fil
`src/pages/AnsattDetail.tsx` — grid-klasse og rekkefølge på `InfoRow`-elementer.
