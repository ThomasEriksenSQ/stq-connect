

## Tre-stegs toggle for Innkjøper-filteret

### Oppførsel
1. Klikk 1: Vis kun innkjøpere (`call_list === true`)
2. Klikk 2: Vis kun IKKE-innkjøpere (`call_list !== true`)
3. Klikk 3: Tilbake til "alle" (filter av)

### Endringer

**Fil: `src/pages/Contacts.tsx`**

1. **Endre `typeFilter` fra enkel string til å støtte `not_call_list`-verdi.** Legg til ny verdi `"not_call_list"` som et tredje steg. Filtreringslogikken (linje ~709-713) utvides:
   ```
   (typeFilter === "not_call_list" && !contact.call_list)
   ```

2. **Endre Innkjøper-chipen** (linje 1565) fra standard `Chip` til en egendefinert `onClick` som sykler gjennom tre tilstander: `all → call_list → not_call_list → all`. Visuelt vises chipen som aktiv i begge filtertilstander, men med en liten indikator (f.eks. "Innkjøper" vs "Ikke innkjøper" label-bytte) for å vise hvilken retning filteret er i.

3. **Chip-visning:** Når `typeFilter === "not_call_list"`, vis chipen som aktiv med label "Ikke innkjøper". Når `typeFilter === "call_list"`, vis "Innkjøper" som i dag.

Ingen andre endringer.

