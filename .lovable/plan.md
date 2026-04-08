

## Plan: Oppdater erfaring_aar til årstall for alle ansatte

### Data-oppdateringer

Basert på bildet og dine tilleggsinput, settes `erfaring_aar = 2026 - års erfaring`:

| Ansatt | År erfaring | Nytt årstall |
|--------|------------|-------------|
| Ida Abrahamsson | 8 | 2018 |
| Mattis Spieler Asp | 9 | 2017 |
| Karl Eirik Bang Fossberg | 7 | 2019 |
| Anders Larsen | 22 | 2004 |
| Tom Erik Lundesgaard | 20 | 2006 |
| Anders Nilsen | 7 | 2019 |
| Trine Ødegård Olsen | 6 | 2020 |
| Christian Steffen Poljac | 10 | 2016 |
| Lars Rudolfsen | 5 | 2021 |
| Rikke Solbjørg | 5 | 2021 |
| Henning Thorkildsen | 14 | 2012 |
| Martin Tysseland | 5 | 2021 |
| Kacper Wysocki | 20 | 2006 |
| Trond Hübertz Emaus | 9 | 2017 |
| Harald Ivarson Moldsvor | 7 | 2019 |

Filip Dovland har ingen verdi i bildet — beholdes som null med mindre du ønsker noe annet.

### Teknisk
- Én UPDATE-query per ansatt via Supabase insert-verktøyet
- Ingen kodeendringer — UI-en beregner allerede `2026 - erfaring_aar` dynamisk

