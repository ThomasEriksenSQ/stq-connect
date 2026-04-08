

## Plan: Flytt Status-seksjonen nederst i redigeringsoverlayen

### Endring i `src/components/AnsattDetailSheet.tsx`

1. **Fjern** Status-blokken fra nåværende posisjon (linje 473–491)
2. **Sett inn** samme blokk rett før Save/Cancel-footeren (før linje 578), etter kompetanse-seksjonen og før `</div>` som lukker innholdsområdet

Kun én fil endres: `src/components/AnsattDetailSheet.tsx`

