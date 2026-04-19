
## Mål
Erstatte tekst-knappen "Skjul" nederst i Design Lab-sidebaren med en mer moderne, minimalistisk løsning for å collapse/expand menyen.

## Funn
I `src/components/designlab/DesignLabSidebar.tsx` (linje ~135–158) ligger collapse-knappen som en full-bredde rad med ChevronsLeft-ikon + teksten "Skjul". Dette tar unødvendig plass og duplikerer footer-mønsteret til "Innstillinger" og "Logg ut", noe som gjør det visuelt tyngre enn nødvendig.

## Forslag (anbefalt)
Flytt collapse-toggle til en liten, diskret ikon-knapp øverst til høyre i sidebaren — ved siden av/under logoen. Mønsteret er kjent fra Linear, Notion og Height: en liten `PanelLeft`-ikonknapp som vises ved hover på sidebaren.

### Konkret plan
1. **Fjerne** den eksisterende "Skjul"-knappen fra footer-blokken (linje ~135–158).
2. **Legge til** en liten ikon-knapp i logo-raden, høyrejustert:
   - Ikon: `PanelLeft` (lucide) — moderne standard for sidebar-toggle
   - Størrelse: 14×14, stroke 1.5
   - Container: 22×22, radius 4px, transparent bakgrunn
   - Vises kun ved hover på sidebaren (opacity 0 → 1, transition 150ms) — holder UI rent når musen er borte
   - Tooltip via `title`: "Skjul sidebar" / "Utvid sidebar"
3. **I collapsed-modus**: Knappen vises sentrert under logoen (alltid synlig der, siden det er eneste måten å utvide tilbake), bruker `PanelLeftOpen`-ikon.
4. **Farger**: `C.textFaint` default, `C.text` på hover, hover-bg `C.hoverSubtle`.
5. **Group-hover**: Legge `group` på `<aside>` og `opacity-0 group-hover:opacity-100` på knappen i expanded modus.

### Visuelt resultat
```
Expanded:                Collapsed:
┌──────────────────┐     ┌────┐
│ [STACQ logo]  ‹‹ │     │ ▣  │
│                  │     │ ›› │
│ CRM              │     │    │
│  Salgsagent      │     │ ▣  │
│  Selskaper       │     │ ▣  │
```

Ikonet ligger inline i logo-raden i stedet for som en egen rad nederst — mer moderne, mindre støy.

## Utenfor scope
- Endre selve animasjonen av sidebar-bredden.
- Endre footer-knappene (Innstillinger, Logg ut, brukeravatar).
- Legge til tastatursnarvei (kan vurderes som oppfølging).
