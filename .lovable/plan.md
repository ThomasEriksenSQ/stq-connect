
## Mål
Gjøre ikonene i collapsed Design Lab-sidebar betydelig større, mens de fortsatt skalerer med tekststørrelse-kontrollen (S/M/L/XL/XXL).

## Funn
I `src/components/designlab/DesignLabSidebar.tsx`:
- Nav-ikoner: `width/height: px(14)` i både expanded og collapsed modus
- Footer-ikoner (Innstillinger, Logg ut, Toggle): `px(14)`
- Rad-høyde: `px(28)` — knappen er kun 28px høy i collapsed modus, så ikonet kan ikke være mye større enn ~16px uten å sprenge

I expanded modus skal ikonene forbli 14px (matcher 13px tekst — Linear-stil). Men i **collapsed** modus er det ingen tekst, og dagens 14px ikoner ser unødvendig små og "tapte" ut i en 48px bred sidebar (jf. skjermbilde).

## Løsning
Bruk forskjellig ikonstørrelse og radhøyde basert på `collapsed`-tilstand:

### Endringer i `DesignLabSidebar.tsx`

1. **Nav-ikoner i `NavGroup`**:
   - Expanded: `px(14)` (uendret)
   - Collapsed: `px(20)` — ca 43% større, mye bedre touch-target og visuell vekt
   - Rad-høyde collapsed: `px(34)` (fra `px(28)`) for å gi rom

2. **Footer-knapper i `FooterBtn`** (Innstillinger, Logg ut):
   - Samme behandling: `px(20)` i collapsed, `px(34)` rad-høyde

3. **CollapseToggle**:
   - Collapsed (full row): ikon `px(20)`, høyde `px(34)`
   - Expanded (i avatar-raden): forblir `px(14)` / `px(24)` (kompakt)

4. **Logo i collapsed modus**:
   - Justere fra `px(22)` → `px(24)` for bedre visuell balanse mot de større ikonene

### Sidebar-bredde
Beholder 48px collapsed bredde — 20px ikoner sentrert i 48px gir 14px luft hver side, perfekt visuell balanse.

### Skalering bevart
Alle verdier bruker `px(value)` som multipliserer med `scale` fra `SCALE_MAP[textSize]`. Dermed:
- S (0.85): nav-ikon collapsed = 17px
- M (1.0): 20px
- L (1.15): 23px
- XL (1.30): 26px
- XXL (1.45): 29px

### Visuelt resultat
```
Før (collapsed):     Etter (collapsed):
┌────┐               ┌────┐
│ ▣  │ 14px          │ ▣  │ 20px
│ ▣  │               │    │
│ ▣  │               │ ▣  │
│ ▣  │               │    │
└────┘               │ ▣  │
                     └────┘
```

## Filer som endres
- `src/components/designlab/DesignLabSidebar.tsx` — kun ikon- og radhøyde-tall, ingen strukturelle endringer

## Utenfor scope
- Endre sidebar-bredden i collapsed (48px beholdes)
- Endre expanded-modus ikonstørrelser (forblir 14px for Linear-tetthet)
- Endre `SCALE_MAP` eller tekststørrelse-systemet
