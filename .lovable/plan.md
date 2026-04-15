

# Plan: Identisk Linear-stilsett for Design Lab

## Problemet

Design Lab bruker varme, gulaktige fargetoner (#F7F6F2, #28251D, rgba(40,37,29,...)) som gir et "kraft-papir"-uttrykk. Linear bruker kalde, nøytrale gråtoner. Bordere er for subtile (3% opacity) vs. Linears synlige #d0d6e0. Tekst- og bakgrunnsfarger matcher ikke.

## Linears faktiske verdier (light mode)

Fra Linears design-system:

```text
Bakgrunner:
  Page bg:      #f7f8f8  (kald lysegrå, IKKE varm)
  Surface:      #f3f4f5  (sidebar, panels)  
  Card/Content: #ffffff  (hvit)

Tekst:
  Primary:      #1d2028  (mørk cool-grå)
  Secondary:    #6b6f76  (medium grå)
  Tertiary:     #8a8f98  (placeholders)
  Quaternary:   #a2a5ab  (disabled, timestamps)

Border:         #e6e6e6  (light mode, synlig)
                #d0d6e0  (dividers, sterkere)

Aksent:         #5e6ad2  (indigo — Linear bruker indigo, vi beholder teal)

Font:           Inter Variable
Spacing:        4px base unit
Row height:     36px (issues list)
Sidebar width:  ~220px
Header height:  44px
Border-radius:  4-6px (ikke rounded-full på nav)
```

## Endringer

### 1. Oppdater fargekonstanter (`C` object) i DesignLabContacts.tsx

```text
NÅVÆRENDE → NYTT
bg:         #F7F6F2 → #f7f8f8
surface:    #FFFFFF → #ffffff (uendret)
text:       #28251D → #1d2028
textMuted:  #6B6B66 → #6b6f76
textFaint:  #9C9C97 → #8a8f98
textGhost:  #BAB9B4 → #a2a5ab
border:     rgba(40,37,29,0.08) → #e6e6e6
borderLight: rgba(40,37,29,0.05) → #eff0f1
hoverBg:    rgba(40,37,29,0.035) → rgba(0,0,0,0.03)
activeBg:   rgba(1,105,111,0.04) → rgba(94,106,210,0.06)
shadow:     0 1px 3px rgba(40,37,29,0.06) → 0 1px 2px rgba(0,0,0,0.04)
```

### 2. Sidebar-justeringer

- Nav-items: padding `py-[5px]` (fra 6px), borderRadius `6px` (ikke rounded-full)
- Active item: bg `rgba(0,0,0,0.05)` (kaldere)
- Workspace header: same height (48px → 44px)
- Search trigger kbd: bakgrunn `rgba(0,0,0,0.06)`
- Section labels: farge → `#a2a5ab`

### 3. Header og filter-bar

- Header height: 48px → 44px
- Search input: border `#e6e6e6`, border-radius `6px`
- Filter pill-knapper: borderRadius `6px` (ikke rounded-full), border `#e6e6e6`
- Active filter: bakgrunn `#5e6ad2` (Linears indigo) eller beholde `#01696F` (vår teal)
- ColHeader: letter-spacing `0.04em` (fra 0.06em)

### 4. Tabellrader

- Row height: 38px → 36px
- Border-bottom: `#eff0f1` (synlig men subtil)
- Hover: `rgba(0,0,0,0.02)`
- Active: `rgba(94,106,210,0.04)` eller `rgba(1,105,111,0.04)` med teal

### 5. Detaljpanel

- Header border-bottom: `#e6e6e6`
- Bakgrunn: `#ffffff`

### 6. Signal/Heat badges

Oppdater til kaldere toner som matcher den nøytrale paletten (valgfritt — kan beholde V8-fargene).

### 7. Tilsvarende endringer i DesignLabForesporsler.tsx og DesignLabStacqPrisen.tsx

Alle tre sider deler ikke fargepaletten direkte, så C-objektet må oppdateres i alle tre filene. Alternativt kan vi ekstrahere C til en delt fil, men det er scope-creep — holder det inline per side for nå.

## Filer som endres

1. `src/pages/DesignLabContacts.tsx` — C-objekt, sidebar, header, filter, tabell, detalj
2. `src/pages/DesignLabForesporsler.tsx` — C-objekt, farger, border, spacing
3. `src/pages/DesignLabStacqPrisen.tsx` — C-objekt, farger, border, spacing

## Valg: Beholde teal (#01696F) som aksent?

Linear bruker indigo (#5e6ad2) som sin aksent. Vi kan enten:
- **Beholde teal** som vår differensiering (STACQ-branding)
- **Bytte til indigo** for 100% Linear-match

Planen beholder teal som aksent, men alle nøytrale farger (bg, text, border) oppdateres til Linears kalde palett.

