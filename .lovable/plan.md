

# Plan: Design Lab Selskaper-side

## Sammendrag
Opprett en ny `/design-lab/selskaper`-side som gjenspeiler funksjonaliteten fra `/selskaper`, men reskinnet i Design Lab V8 Linear-stilen. Ingen endringer på eksisterende `/selskaper`.

## Ny fil: `src/pages/DesignLabCompanies.tsx`

En frittstående side (~500 linjer) som følger samme arkitektur som `DesignLabContacts.tsx`:
- Sidebar (220px) med navigasjon — gjenbruker samme `NAV_MAIN`/`NAV_STACQ`-mønster, med "Selskaper" markert som aktiv
- Header bar (40px) med tittel, antall, søkefelt og "+ Nytt selskap"-knapp
- Filter bar med EIER og TYPE pill-filtre (samme chip-mønster som kontakter)
- Tabell med sorterbare kolonner: Selskap, Type, Signal, Sted, Siste akt., Oppfølginger
- All styling via inline styles med `C`-tokens fra `theme.ts`

**Data:** Henter selskaper med kontakter, aktiviteter og oppgaver — samme query-mønster som `Companies.tsx` men med `crmQueryKeys`. Beregner `getEffectiveSignal` per selskap og viser signal som en prikk + tekst.

**Interaksjon:**
- Klikk på rad → `navigate("/selskaper/{id}")` (bruker eksisterende detaljside)
- Type-dropdown inline i tabellen med optimistisk oppdatering
- Sortering: klikk kolonneheader (navn, type, sted, siste aktivitet)
- Søk filtrerer på navn, org.nr, by

**Visuell stil (V8):**
- 34px radhøyde, 13px tekst, `C.hoverBg` hover
- Signal-prikk (7px) + 12px tekst med `SIGNAL_COLORS` fra theme
- Type som plain tekst med chevron-dropdown (ikke badge)
- Seksjonstitler 11px/500/`C.textFaint`

## Endring: `src/App.tsx`

Legg til lazy import og route:
```ts
const DesignLabCompanies = lazy(() => import("./pages/DesignLabCompanies"));
```
Route under `/design-lab`:
```tsx
<Route path="selskaper" element={<Suspense fallback={<LazyFallback />}><DesignLabCompanies /></Suspense>} />
```

## Endring: `src/pages/DesignLabContacts.tsx`

Oppdater `NAV_MAIN` for å peke "Selskaper" til `/design-lab/selskaper` i stedet for `/selskaper`:
```ts
{ label: "Selskaper", icon: Building2, href: "/design-lab/selskaper" },
```

## Filer som endres
- **Ny:** `src/pages/DesignLabCompanies.tsx`
- **Endret:** `src/App.tsx` (import + route)
- **Endret:** `src/pages/DesignLabContacts.tsx` (sidebar link)

