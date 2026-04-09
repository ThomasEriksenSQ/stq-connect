

## Plan: Fjern "Cold call" (referanse-tekst) fra prosess-fanene

### Endring i `src/pages/AnsattDetail.tsx`

Fjern referanse-linjene fra begge prosess-faner:

1. **Linje 376–378**: Fjern `{f?.referanse && (<p>...</p>)}` fra "Aktive prosesser".
2. **Linje 410–412**: Fjern `{f?.referanse && (<p>...</p>)}` fra "Tidligere prosesser".

Kun én fil endres.

