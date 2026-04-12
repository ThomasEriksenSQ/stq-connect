

## Sorterbare kolonner for MATCH og VARME i jaktmodus

### Problem
Kolonne-headerne MATCH og VARME i jaktmodus-tabellen er statisk tekst. Brukeren vil kunne klikke på dem for å sortere listen.

### Løsning
Legg til en lokal `huntSort` state med felt og retning. Gjør MATCH og VARME headers klikkbare med ArrowUpDown-ikon. Sorter `visibleMatchLeads` basert på valgt kolonne før rendering.

### Teknisk plan

**Fil: `src/pages/Contacts.tsx`**

1. **Ny state** (ved linje ~259, nær andre state-variabler):
   ```ts
   type HuntSortField = "default" | "match" | "varme";
   const [huntSort, setHuntSort] = useState<{ field: HuntSortField; dir: SortDir }>({ field: "default", dir: "desc" });
   ```

2. **Toggle-funksjon**:
   ```ts
   const toggleHuntSort = (field: "match" | "varme") => {
     setHuntSort(prev =>
       prev.field === field
         ? { field, dir: prev.dir === "desc" ? "asc" : "desc" }
         : { field, dir: "desc" }
     );
   };
   ```

3. **Sortert liste** (etter linje ~1311 der `visibleMatchLeads` defineres):
   Erstatt `const visibleMatchLeads = selectedConsultant ? matchResults.leads : [];` med en sortert versjon som anvender `huntSort` etter den eksisterende default-sorteringen. Map temperature til numerisk verdi (hett=4, lovende=3, mulig=2, sovende=1, null=0) for varme-sortering.

4. **Klikkbare headers** (linje 1741-1742):
   Endre MATCH og VARME `<span>` til `<button>` med `onClick={() => toggleHuntSort("match")}` etc. Legg til `ArrowUpDown`-ikon (allerede importert) ved siden av teksten. Vis aktiv retning med visuell indikator.

5. **Nullstill huntSort** når konsulent byttes eller jaktChip endres (i eksisterende handlers).

### Ingen andre endringer
Ingen logikk, matchberegning, eller annen funksjonalitet endres.
