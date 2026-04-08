
## Plan: Fjern kompetanse-seksjonen fra "Ny ansatt"-skjemaet

### Endring
I `src/components/AnsattDetailSheet.tsx`, endre betingelsen på linje 500 fra `{!kompetanseStyresAvCv && (` til `{!isCreate && !kompetanseStyresAvCv && (` slik at kompetanse-seksjonen skjules helt ved opprettelse av nye ansatte.

### Begrunnelse
Kompetanse legges automatisk til via CV-editoren, så det er unødvendig å vise feltet ved opprettelse.

Kun én linje endres i én fil.
