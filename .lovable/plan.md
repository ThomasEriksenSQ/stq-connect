

# Plan: Tre distinkte bakgrunnsnivåer som Linear

## Problemet

Sidebaren og hovedflaten bruker begge `C.bg` (`#f7f8f8`), så de ser like ut. Linear har tre tydelige bakgrunnslag:

```text
Sidebar:       #ededef  (mørkest — tydelig "panel"-følelse)
Hovedflate:    #f7f8f8  (mellomtone — lister/tabeller)
Detaljpanel:   #ffffff  (hvit — fokusvindu)
```

## Endringer

### Alle tre Design Lab-sider

1. **Legg til ny farge i `C`-objektet**: `sidebarBg: "#ededef"` (eller `#ecedf0` — Linears faktiske sidebar-farge i light mode)

2. **Sidebar `<aside>`**: Endre `background: C.bg` → `background: C.sidebarBg`

3. **Hovedflate** (tabell-området): Beholder `C.bg` (`#f7f8f8`) — dette er allerede riktig

4. **Detaljpanel**: Beholder `C.surface` (`#ffffff`) — dette er allerede riktig

### Filer som endres

- `src/pages/DesignLabContacts.tsx` — sidebar background
- `src/pages/DesignLabForesporsler.tsx` — sidebar background  
- `src/pages/DesignLabStacqPrisen.tsx` — sidebar background

Resultatet gir tre tydelig adskilte soner: mørk sidebar → mellomtone liste → hvit fokusfelt, akkurat som Linear.

