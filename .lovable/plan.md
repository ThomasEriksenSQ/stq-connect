

## Plan: Legg til kontaktperson på oppdrag og prosesser

### Oversikt
Vise kontaktpersonens navn (fra forespørslens `kontakt_id → contacts.name`) som en undertekst på alle faner: aktive/tidligere oppdrag og aktive/tidligere prosesser.

### Endring i `src/pages/AnsattDetail.tsx`

**1. Utvid prosess-queries med kontaktperson**

Endre select i begge prosess-queries (`aktiveProsesser` og `tidligereProsesser`) fra:
```
foresporsler(id, selskap_navn, teknologier, referanse)
```
til:
```
foresporsler(id, selskap_navn, teknologier, referanse, kontakt_id, contacts(name))
```

Dette gir tilgang til `f?.contacts?.name` i prosess-radene.

**2. Hent kontaktpersoner for oppdrag via "vunnet"-prosesser**

Legg til en ny query som henter alle "vunnet"-prosesser for denne ansatte, med kontaktperson-navn og `selskap_id`:
```ts
const { data: vunnetKontakter = [] } = useQuery({
  queryKey: ["ansatt-vunnet-kontakter", ansattId],
  queryFn: async () => {
    const { data } = await supabase
      .from("foresporsler_konsulenter")
      .select("foresporsler(selskap_id, kontakt_id, contacts(name))")
      .eq("ansatt_id", ansattId)
      .eq("status", "vunnet");
    return data ?? [];
  },
});
```

Bygg et oppslagskart `selskapIdToKontakt` fra dette resultatet, slik at oppdragsrader kan slå opp kontaktperson via `o.selskap_id`.

**3. Vis kontaktperson i prosess-rader**

I begge prosess-faner, legg til en linje under selskapsnavnet:
```tsx
{f?.contacts?.name && (
  <p className="text-[0.75rem] text-muted-foreground">{f.contacts.name}</p>
)}
```

**4. Vis kontaktperson i OppdragRow**

Legg til en ny prop `kontaktNavn` på `OppdragRow` og vis den som undertekst:
```tsx
{kontaktNavn && (
  <span className="text-[0.8125rem] text-muted-foreground">· {kontaktNavn}</span>
)}
```

Send inn kontaktnavnet fra oppslagskartet når `OppdragRow` rendres.

Kun `src/pages/AnsattDetail.tsx` endres.

