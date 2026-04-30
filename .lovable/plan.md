## Endring

Fil: `src/pages/Pipeline.tsx`

1. Utvid `stats`-useMemo (rundt linje 632–645) med to nye tellinger basert på `filteredItems`:
   - `rejected`: `item.status === "avslag"`
   - `lapsed`: `item.status === "bortfalt"`

2. I stat-grid (rundt linje 742–746): endre fra `sm:grid-cols-3` til `sm:grid-cols-5` og legg til to nye `PipelineStat`-bokser etter "Vunnet":
   - `<PipelineStat label="Avslag" value={stats.rejected} />`
   - `<PipelineStat label="Bortfalt" value={stats.lapsed} />`

Begge boksene følger samme filter-logikk som "Vunnet" (reagerer på status/type/kilde-filtrene).
