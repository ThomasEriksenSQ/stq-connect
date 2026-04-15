

# Plan: Detaljpanel for selskaper i Design Lab

## Sammendrag
Legg til et inline detaljpanel på `/design-lab/selskaper` som åpnes ved klikk på en rad — identisk arkitektur som kontaktsiden med `ResizablePanelGroup`, tre paneler, og mulighet til å justere bredde fra begge sider.

## Endring: `src/pages/DesignLabCompanies.tsx`

**Ny state:**
- `selectedId: string | null` — valgt selskap

**Layout-endring:**
Erstatt den nåværende `<div className="flex-1 min-h-0 overflow-y-auto">` tabellen med en `ResizablePanelGroup` (importert fra `@/components/ui/resizable`) med tre paneler:

```
ResizablePanelGroup (horizontal)
├─ Panel 1: Tabellen (defaultSize=35, minSize=20, maxSize=60)
├─ ResizableHandle (withHandle)
├─ Panel 2: CompanyCardContent (defaultSize=65, minSize=30)
├─ ResizableHandle (withHandle)
└─ Panel 3: Tomt spacer-panel (defaultSize=0, minSize=0, maxSize=40)
```

**Rad-klikk:** Endres fra `navigate("/selskaper/{id}")` til `setSelectedId(id)` (toggle ved nytt klikk).

**Panel 2 innhold:**
- Når `selectedId` er satt: Topplinje med X-lukkeknapp (32px), deretter `<CompanyCardContent companyId={selectedId} editable />` i scrollbar-div med `dl-v8-theme`-klasse.
- Når ingen er valgt: Tom bakgrunn med `C.appBg`.

**Aktiv rad-markering:** Samme mønster som kontakter — `background: C.activeBg` når valgt.

**Importer:**
- `ResizablePanelGroup, ResizablePanel, ResizableHandle` fra `@/components/ui/resizable`
- `CompanyCardContent` fra `@/components/CompanyCardContent`

Ingen andre filer endres.

