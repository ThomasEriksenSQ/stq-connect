

## Plan: Vis kun første linje av kompetanse-chips i AnsattDetailSheet

Bruk samme `KompetanseCollapsible`-mønster som allerede finnes i `AnsattDetail.tsx` — én rad med chips, `max-h-[26px]` og en "Vis mer"-knapp.

### Endring i `src/components/AnsattDetailSheet.tsx`

Erstatt den enkle `flex-wrap`-listen av tech tags (linje 615–627) med en collapsible variant:

- Legg til `useState` for `expanded` og `useRef` + `useEffect` for å sjekke om innholdet overskrider én linje (scrollHeight > 40)
- Vis chips i en `div` med `max-h-[26px] overflow-hidden` når ikke ekspandert
- Legg til "Vis mer" / "Vis mindre"-knapp under (kun når det er nødvendig med trunkering)
- Bruker identisk stil som `KompetanseCollapsible` i `AnsattDetail.tsx`

### Kun én fil endres
- `src/components/AnsattDetailSheet.tsx`

