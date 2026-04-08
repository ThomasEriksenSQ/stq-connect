

## Plan: Reorganiser informasjonsseksjonen + legg til fødselsdato

### Oversikt
Reorganiserer info-griddet i tre kolonner med ny rekkefølge, og legger til fødselsdato som nytt felt.

### 1. Database-migrering
Legg til `fodselsdato` (type `date`, nullable) i `stacq_ansatte`-tabellen.

### 2. Oppdater TypeScript-typer
Legg til `fodselsdato: string | null` i Row, Insert og Update for `stacq_ansatte` i `src/integrations/supabase/types.ts`.

### 3. Oppdater `src/pages/AnsattDetail.tsx`

**Hent `fodselsdato`** i select-queryen.

**Beregn alder** fra fødselsdato (differenceInYears fra date-fns).

**Ny kolonne-rekkefølge i griddet:**

```text
Kolonne 1          Kolonne 2            Kolonne 3
─────────          ─────────            ─────────
E-post             Tilgjengelig fra     Startdato
Telefon            Års erfaring         Ansatt i
Geografi           Fødselsdato (alder)  Sluttdato
```

Fødselsdato vises som `d. MMM yyyy` med beregnet alder i parentes, f.eks. `15. jan 1990 (36 år)`.

### 4. Oppdater AnsattDetailSheet (edit-modus)
Legg til fødselsdato-felt i "Intern (CRM)"-seksjonen med `<Input type="date">`.

### Filer som endres
- Ny migrering: `supabase/migrations/XXXX_add_fodselsdato.sql`
- `src/integrations/supabase/types.ts`
- `src/pages/AnsattDetail.tsx`
- `src/components/AnsattDetailSheet.tsx` (edit-modus)

