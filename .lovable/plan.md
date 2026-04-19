

## Bekreftelse: ja, all interaksjonslogikk er intakt

Jeg har sjekket `src/pages/DesignLabContacts.tsx` (linje 2008–2066 og rundt klikk-handlerne). Hele systemet rundt "Tilgjengelig for oppdrag"-baren ligger der fortsatt:

### Hva som finnes i koden i dag

1. **Selve baren** (linje 2008–2066) — horisontal scrollbar rad med konsulent-kort, hvert kort viser navn, kompetanse-tags og tilgjengelighets-badge.
2. **Klikk-handler på konsulent-kort** — setter `activeConsultantFilter` til konsulentens navn/id, som filtrerer kontaktlisten til kun de kontakter som matcher konsulentens kompetanse (via `getConsultantMatchTags`).
3. **Aktiv-tilstand** — det valgte kortet får visuell markering (border/bakgrunn) når filteret er aktivt.
4. **Match-tags på kontaktrader** — når en konsulent er valgt, vises overlappende teknologi-tags på hver kontakt-rad slik at man ser *hvorfor* kontakten matcher.
5. **Avbryt-filter** — klikk på samme kort igjen, eller på "X" i filterindikatoren, fjerner `activeConsultantFilter`.
6. **Sortering** — kontakter sorteres slik at de med flest matchende tags kommer øverst når et konsulentfilter er aktivt.
7. **Hjelpefunksjoner** i `src/lib/contactHunt.ts`: `sortHuntConsultants`, `getConsultantMatchTags`, `getTechnologyMatchTags` — alle uendret.

### Hva som skjer etter endringen i alternativ A

Endringen jeg foreslår er **kun** i `getConsultantAvailabilityMeta` (synlighetsregelen). All klikk-, filter- og match-logikken over er helt urørt. Når Tom Erik (24. apr.) og de tre andre (1. sep.) blir synlige igjen, vil de:

- vises som kort i baren med "Tilgjengelig 24. apr." / "Tilgjengelig 1. sep." badge
- være klikkbare → setter konsulentfilter på kontaktlisten
- vise match-tags på kontaktene som matcher deres kompetanse
- kunne avbrytes ved klikk igjen

### Bekreftelse før jeg gjør endringen

Jeg trenger bare grønt lys på vindusbredden:

- **90 dager fram** (min anbefaling — fanger Tom Erik tydelig, viser sept.-konsulentene som "later")
- **60 dager fram** (samme vindu som bakover, mer symmetrisk — sept.-konsulentene faller utenfor)
- **Annet antall dager**

Når du har valgt, gjør jeg minimal endring i `src/lib/contactHunt.ts` + oppdaterer `src/test/contactHunt.test.ts`. Ingen endringer i `DesignLabContacts.tsx` eller andre filer — klikk-/filterlogikken plukker opp synligheten automatisk.

