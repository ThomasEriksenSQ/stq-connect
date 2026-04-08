

## Plan: Legg til fødselsdatoer for ansatte

### Bakgrunn
Fra bildet har vi fødselsdatoer for 12 ansatte som mangler dette i databasen. Christian (id 1) har allerede dato. Jon Richard Nygaard og Thomas Eriksen er systembrukere, ikke i `stacq_ansatte`. Filip Dovland, Harald Ivarson Moldsvor og Trond Hübertz Emaus er ikke i bildet.

### Endring: SQL-migrasjon

Kjøre en UPDATE mot `stacq_ansatte` for å sette `fodselsdato`:

| Navn | ID | Fødselsdato |
|---|---|---|
| Kacper Wysocki | 2 | 1982-09-11 |
| Anders Nilsen | 3 | 1995-03-01 |
| Henning Thorkildsen | 4 | 1986-05-31 |
| Ida Abrahamsson | 5 | 1994-07-01 |
| Trine Ødegård Olsen | 7 | 1995-03-09 |
| Karl Eirik Bang Fossberg | 8 | 1991-08-29 |
| Mattis Spieler Asp | 9 | 1990-08-19 |
| Lars Rudolfsen | 10 | 1994-10-20 |
| Tom Erik Lundesgaard | 11 | 1974-07-04 |
| Martin Tysseland | 12 | 1994-01-01 |
| Rikke Solbjørg | 14 | 1997-08-11 |
| Anders Larsen | 15 | 1978-12-13 |

Tre ansatte (Filip Dovland id 6, Harald Moldsvor id 13, Trond Emaus id 16) finnes ikke i bildet og oppdateres ikke.

### Teknisk gjennomføring
En database-migrasjon med 12 UPDATE-setninger. Ingen kodeendringer.

