## Problem

UTVALG og STATUS deler i dag samme `statusFilter`-state (én verdi: `"alle" | "tilgjengelige" | PipelineStatus`). Når brukeren velger en konkret status (f.eks. "Intervju"), tvinges UTVALG til "Alle". De skal være uavhengige.

## Endring

Splitt i to states i `src/pages/Pipeline.tsx`:

- `selectionFilter: "alle" | "tilgjengelige"` (default `"tilgjengelige"`) — styrer UTVALG.
- `statusFilter: "alle" | PipelineStatus` (default `"alle"`) — styrer STATUS.

### Detaljer

1. **Typer (linje ~48)** — bytt `FilterStatus` med to typer:
   ```ts
   type SelectionFilter = "alle" | "tilgjengelige";
   type StatusFilter = "alle" | PipelineStatus;
   ```

2. **Helpers (linje ~189–199)** — fjern `statusFilterLabel`/`statusFilterValue` overflødigheten. Behold enkel mapping for STATUS-labels:
   ```ts
   function statusFilterValue(label: string): StatusFilter {
     if (label === "Alle") return "alle";
     return PIPELINE_STATUS_VALUES.find((v) => PIPELINE_STATUS_META[v].label === label) ?? "alle";
   }
   ```

3. **State (linje ~354)**:
   ```ts
   const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>("tilgjengelige");
   const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
   ```

4. **filteredItems (linje ~555–561)** — anvend begge:
   ```ts
   pipelineItems.filter((item) => {
     if (typeFilter !== "alle" && item.consultantType !== typeFilter) return false;
     if (sourceFilter !== "alle" && item.source !== sourceFilter) return false;
     if (selectionFilter === "tilgjengelige" && !isAvailablePipelineItem(item)) return false;
     if (statusFilter !== "alle" && item.status !== statusFilter) return false;
     return true;
   })
   ```

5. **Bench-grupper (linje ~563–588)** — vis kun når `selectionFilter === "tilgjengelige" && statusFilter === "alle" && sourceFilter === "alle" && typeFilter !== "ekstern"`.

6. **resetFilters** — sett begge til defaults.

7. **UTVALG-rad (linje 719–724)**:
   ```tsx
   value={selectionFilter === "tilgjengelige" ? "Tilgjengelige" : "Alle"}
   onChange={(v) => setSelectionFilter(v === "Tilgjengelige" ? "tilgjengelige" : "alle")}
   ```

8. **STATUS-rad (linje 725–734)**:
   ```tsx
   value={statusFilter === "alle" ? "Alle" : PIPELINE_STATUS_META[statusFilter].label}
   onChange={(v) => setStatusFilter(statusFilterValue(v))}
   ```

9. **Nullstill-betingelse (linje 742)** — oppdater til:
   ```ts
   selectionFilter !== "tilgjengelige" || statusFilter !== "alle" || typeFilter !== "alle" || sourceFilter !== "alle"
   ```

### Effekt
- Default: UTVALG = "Tilgjengelige", STATUS = "Alle" — viser tilgjengelige konsulenter (alle statuser).
- Velger man STATUS = "Intervju": UTVALG forblir "Tilgjengelige", og listen viser tilgjengelige konsulenter med status Intervju.
- "Vunnet"-stat o.l. teller fortsatt fra `filteredItems`, så de reflekterer kombinasjonen.
