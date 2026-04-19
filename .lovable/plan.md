

## Mål
Legge inn to nye kolonner — **Geografi** og **Års erfaring** — rett etter NAVN i ansatt-tabellen i Design Lab.

## Funn
- Tabellen ligger i `src/pages/DesignLabKonsulenterAnsatte.tsx`.
- Dagens grid (linje 35): `GRID_TEMPLATE = "minmax(220px,2.2fr) 120px 120px 110px 110px"` med kolonnene: **Navn · Start · Ansatt i · Oppdrag · Fornyes**.
- `stacq_ansatte` har feltene `geografi` (text) og `erfaring_aar` (integer) som allerede leses inn via `select("*")`.
- Søkefilteret inkluderer allerede `row.geografi` (linje 181), så søkbarhet er på plass.
- `KonsulenterAnsatte.tsx` (V1) er ikke berørt — kun Design Lab-tabellen, slik som forrige stilendring.

## Løsning
Én fil endres: `src/pages/DesignLabKonsulenterAnsatte.tsx`.

### 1) Utvid grid-template
```ts
// Fra:
const GRID_TEMPLATE = "minmax(220px,2.2fr) 120px 120px 110px 110px";
// Til (Geografi + Års erfaring rett etter Navn):
const GRID_TEMPLATE = "minmax(220px,2.2fr) 140px 90px 120px 120px 110px 110px";
```
- **Geografi**: 140px (rom for "Oslo og omegn")
- **Års erfaring**: 90px, høyrejustert verdi (kort tall som "12 år")

### 2) Oppdater header-labels (linje 399)
```
["Navn", "Geografi", "Erfaring", "Start", "Ansatt i", "Oppdrag", "Fornyes"]
```

### 3) Legg inn de to nye cellene i `renderRow` rett etter navn-cellen (etter linje 291)
```tsx
<div className="truncate" style={{ fontSize: 13, color: C.textMuted }}>
  {row.geografi || "–"}
</div>
<div style={{ fontSize: 13, color: C.textMuted }}>
  {row.erfaring_aar ? `${row.erfaring_aar} år` : "–"}
</div>
```
Plassering: mellom navn-blokken og Start-kolonnen.

### 4) Visuelt resultat
```
┌──────────────┬──────────┬─────────┬──────────┬─────────┬──────────┬──────────┐
│ NAVN         │ GEOGRAFI │ ERFARING│ START    │ ANSATT I│ OPPDRAG  │ FORNYES  │
├──────────────┼──────────┼─────────┼──────────┼─────────┼──────────┼──────────┤
│ ⓐ Anders L.  │ Oslo     │ 12 år   │ 01.03.22 │ 36 mnd  │ I oppdrag│ Om 21d   │
│ ⓑ Berit K.   │ Bergen   │ 8 år    │ 15.09.23 │ 18 mnd  │ —        │ —        │
└──────────────┴──────────┴─────────┴──────────┴─────────┴──────────┴──────────┘
```

## Fil som endres
- `src/pages/DesignLabKonsulenterAnsatte.tsx` — `GRID_TEMPLATE`, header-array og to nye celler i `renderRow`.

## Utenfor scope
- V1-versjonen (`/konsulenter/ansatte` i klassisk CRM) — uendret, slik som forrige iterasjon.
- Sortering på de nye kolonnene — kan legges til senere hvis ønsket.
- Inline-redigering av geografi/erfaring fra tabellen — redigeres fortsatt i sidepanelet/profil.

