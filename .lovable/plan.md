

# Plan: Global tekststørrelse-kontroll for Design Lab

## Hva skal gjøres

Legge til en tekststørrelse-kontroll øverst til høyre i alle Design Lab-sider. Brukeren kan velge mellom nivåer som skalerer all tekst i V8-designet. Valget lagres med `usePersistentState` slik at det huskes mellom sidebesøk.

## Visuell plassering

Øverst til høyre i header-området på alle Design Lab-sider, ved siden av tittel/søk. Enkle pill-knapper med nivåer:

```text
  STACQ Prisen                          [S] [M] [L] [XL]
```

## Nivåer

| Nivå | CSS font-size scale | Beskrivelse |
|------|-------------------|-------------|
| S    | 0.875 (87.5%)     | Kompakt     |
| M    | 1.0 (100%)        | Standard    |
| L    | 1.125 (112.5%)    | Stor        |
| XL   | 1.25 (125%)       | Ekstra stor |

## Teknisk tilnærming

Wrapper-div rundt innholdet i hver Design Lab-side får en inline `style={{ fontSize: scale }}` som via CSS-arv skalerer all tekst. Alternativt bruker vi `rem`-base override via CSS custom property.

## Endringer

### 1. Ny komponent: `src/components/designlab/TextSizeControl.tsx`
- Pill-knapper med V8-styling (aktiv = teal, inaktiv = border)
- Props: `value`, `onChange`
- Bruker `Type` lucide-ikon som label

### 2. Hook: `usePersistentState("dl-text-size", "M")`
- Lagres i localStorage, deles på tvers av alle Design Lab-sider

### 3. Oppdater alle 3 Design Lab-sider
- `DesignLabContacts.tsx`, `DesignLabForesporsler.tsx`, `DesignLabStacqPrisen.tsx`
- Importer `TextSizeControl` og `usePersistentState`
- Plasser kontroll øverst til høyre
- Wrap hovedinnholdet i en div med `style={{ fontSize: scaleMap[size] }}`

