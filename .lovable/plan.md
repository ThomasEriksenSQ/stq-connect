

# Plan: Visuell paritet mellom Design Lab Selskaper og Kontakter

## Problemet
Selskapssiden har annen bakgrunn, spacing og struktur på detaljpanelet enn kontaktsiden. Tabellen bruker betinget rendering av `ResizablePanelGroup` i stedet for å alltid ha den montert.

## Endringer i `src/pages/DesignLabCompanies.tsx`

### 1. Alltid monter ResizablePanelGroup (som kontaktsiden)
Fjern den betingede `selectedId ? <ResizablePanelGroup> : <div>` strukturen. Erstatt med en alltid-montert `ResizablePanelGroup` — identisk til kontaktsiden (linje 515-666). Tabellen er alltid i Panel 1, detaljpanel i Panel 2, spacer i Panel 3.

### 2. Detaljpanel-styling lik kontaktkortet
Endre Panel 2 innholdet til å matche kontaktsiden:
- `background: C.panel` (hvit) i stedet for `C.bg`
- `borderLeft: 1px solid ${C.borderLight}` (ikke `C.border`)
- Innhold wrappet i `<div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">`
- Lukkeknapp: `className="rounded p-1 hover:bg-black/5 transition-colors"` (som kontakter)

### 3. ResizableHandle-styling
Legg til samme klasser som kontaktsiden:
```
className="bg-transparent hover:bg-[rgba(0,0,0,0.04)] transition-colors data-[resize-handle-active]:bg-[rgba(94,106,210,0.12)]"
```

### 4. Panel-størrelser
Beholdes som nå: defaultSize={35/65/0}, minSize={20/30/0}, maxSize={60/–/40}.

Kun `src/pages/DesignLabCompanies.tsx` endres.

