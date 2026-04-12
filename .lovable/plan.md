

## Plan: Endre "Opprett i CRM", "Kontaktpersoner" og "Teknologier i vekst" fra bokser til rader

### Endringer i `src/pages/Markedsradar.tsx`

Erstatter de tre seksjonene (linje 357-483) fra grid med kort/bokser til en tabell-lignende rad-layout med `divide-y divide-border`:

**1. Opprett i CRM (linje 357-383)**
- Fjern `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`
- Erstatt med `divide-y divide-border`
- Hver rad: `flex items-center justify-between py-3` med selskapsnavn + teknologier til venstre, "Opprett"-knapp til høyre
- Fjern `rounded-lg border border-border bg-secondary/20 p-3`

**2. Kontaktpersoner (linje 398-445)**
- Samme prinsipp: vertikale rader med `divide-y divide-border`
- Hver rad: Navn + selskap + rolle til venstre, telefon/e-post i midten, treff-badge til høyre
- Alt på én linje per kontakt

**3. Teknologier i vekst (linje 460-482)**
- Rader med `divide-y divide-border`
- Hver rad: Teknologinavn til venstre, "X annonser siste 30 dager" + selskaper i midten, momentum-badge til høyre

### Resultat
Kompakte, lesbare rader i stedet for bokser -- samme informasjon, bedre datatetthet og konsistent med tabellmønsteret brukt andre steder i appen.

