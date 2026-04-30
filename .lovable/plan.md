## Endring

Splitt dagens "STATUS"-filter på `/pipeline` i to rader:

- **UTVALG** (rad 1, før TYPE): `Alle` | `Tilgjengelige`
- **STATUS** (ny rad, etter UTVALG): `Alle` | `Sendt CV` | `Intervju` | `Vunnet` | `Avslag` | `Bortfalt`

Begge styres mot samme eksisterende `statusFilter`-state — ingen ny state introduseres, slik at all nedstrøms filtrering (`filteredItems`, `groups`, `stats.won/rejected/lapsed`) fortsetter å fungere uendret.

### Logikk
- UTVALG aktiv-verdi: `"Tilgjengelige"` når `statusFilter === "tilgjengelige"`, ellers `"Alle"`.
- STATUS aktiv-verdi: status-label når `statusFilter` er en konkret pipeline-status, ellers `"Alle"`.
- Velger man en spesifikk status i STATUS-raden, settes `statusFilter` til den statusen (overstyrer UTVALG).
- Velger man `Tilgjengelige` i UTVALG, settes `statusFilter` til `"tilgjengelige"` (STATUS-raden faller tilbake til "Alle").
- Velger man `Alle` i UTVALG, settes `statusFilter` til `"alle"`.

### Filer
`src/pages/Pipeline.tsx`:

1. Linje 177: Splitt `STATUS_FILTER_OPTIONS` i to konstanter:
   ```ts
   const SELECTION_FILTER_OPTIONS = ["Alle", "Tilgjengelige"] as const;
   const STATUS_FILTER_OPTIONS = ["Alle", ...PIPELINE_STATUS_VALUES.map((v) => PIPELINE_STATUS_META[v].label)] as const;
   ```
2. Linje ~718–723: Bytt ut den ene `DesignLabFilterRow label="STATUS"` med to rader (UTVALG + STATUS) som beskrevet over.
3. Ingen endring i `statusMatchesFilter`, `resetFilters` eller stats — disse leser `statusFilter` som før.
