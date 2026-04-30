## Mål

Legg til "Pipeline" som menyvalg i venstre sidemeny, rett under "Forespørsler", med passende ikon. Klikk skal navigere til `/pipeline`.

## Endringer

### 1. `src/lib/crmNavigation.ts`

Legg til `pipeline` som en `CrmNavItem` og map den til `/pipeline` (samme rute uavhengig av alias siden Pipeline ikke har egen design-lab-variant):

```ts
export type CrmNavItem =
  | "dashboard" | "companies" | "contacts" | "requests"
  | "pipeline"
  | "followUps" | "stacqPrisen" | "markedsradar"
  | "activeAssignments" | "employees" | "externalConsultants"
  | "websiteAi" | "settings";
```

I `ROOT_NAV_PATHS` og `DESIGN_LAB_NAV_PATHS`, legg til:
```ts
pipeline: "/pipeline",
```
(samme verdi i begge — ruten finnes kun på `/pipeline` i `App.tsx`).

### 2. `src/components/designlab/DesignLabSidebar.tsx`

- Importer `GitBranch` fra `lucide-react` (passende ikon for "pipeline").
- I `NAV_MAIN`, legg til en ny rad rett under Forespørsler:
  ```ts
  { label: "Pipeline", icon: GitBranch, key: "pipeline" },
  ```

Resultat: Pipeline vises i hovedmenyen mellom "Forespørsler" og "Oppfølginger", med GitBranch-ikon, og lenker til `/pipeline`. Active-state håndteres automatisk via eksisterende `getNavItemFromPath`.
