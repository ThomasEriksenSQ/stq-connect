

## Plan: Kollaps kompetanse-chips i redigeringsmodus

### Problem
Når CV styrer kompetansefeltet i redigeringsmodus, vises alle chips uten begrensning. Det tar mye plass. Brukeren ønsker samme oppførsel som i visningsmodusen: én rad med "Vis mer"-knapp.

### Endring i `src/components/AnsattDetailSheet.tsx`

Når `kompetanseStyresAvCv` er `true` (feltet er låst), skal chip-containeren (linje 518) begrenses til én rad med `max-h-[26px]` og overflow hidden, med en "Vis mer/Vis mindre"-knapp under — akkurat som `SheetKompetanseCollapsible` allerede gjør i visningsmodusen.

Konkret:
- Legg til en lokal `expandedKomp`-state
- Legg til en `ref` og `useEffect` for å sjekke om innholdet overflyter
- Når `kompetanseStyresAvCv`, begrens containeren med `max-h-[26px]` med mindre `expandedKomp` er true
- Vis "Vis mer"/"Vis mindre"-knapp under når innholdet overflyter

### Kun én fil endres
- `src/components/AnsattDetailSheet.tsx`

