

## Funn

Tabellheaderen i alle tre sider (`DesignLabCompanies`, `DesignLabContacts`, `DesignLabForesporsler`) er en `grid` med `background: C.surfaceAlt` plassert **inne i** en scroll-container (`overflow-y-auto`).

```
<div className="overflow-y-auto">           ← scroll-container (ingen bg)
  <div className="grid sticky top-0"        ← header (grå bg)
       style={{ background: C.surfaceAlt, paddingRight: 16 }}>
    ...kolonner...
  </div>
  ...rader...
</div>
```

Det lille hvite gapet helt til høyre i headeren er plassen som scroll-gutteren / sub-pixel grensen mellom listepanelet og detaljpanelet opptar. Headerens bakgrunn er låst til grid-bredden, mens scroll-containeren bak er hvit/lys (`C.appBg` eller `C.panel` fra detaljpanelet skinner gjennom).

## Plan

Sett `background: C.surfaceAlt` på en sticky wrapper som dekker **hele containerbredden** (inkludert evt. scroll-gutter), og behold gridet med kolonnene inni — uten egen bakgrunn.

### Endringer (3 filer, samme grep)

**`src/pages/DesignLabForesporsler.tsx`** — `TableHeader` (linje 552–562):
- Wrap eksisterende `<div className="grid sticky top-0">` i en ny `<div>` som har `background: C.surfaceAlt`, `borderBottom`, `position: sticky`, `top: 0`, `zIndex: 10`.
- Fjern `background`, `borderBottom`, `sticky`, `top-0`, `z-10` fra det indre grid-elementet (beholder kun `gridTemplateColumns`, `height: 32`, `paddingLeft/Right: 16`, `display: grid`, `items-center`).

**`src/pages/DesignLabCompanies.tsx`** — header-blokk (linje 601–613):
- Samme grep: ny ytre wrapper med grå bakgrunn + sticky, indre grid uten bakgrunn.

**`src/pages/DesignLabContacts.tsx`** — header-blokk (linje 2232–2250):
- Samme grep.

### Resultat

```
<div className="sticky top-0 z-10"           ← NY wrapper, full bredde, grå
     style={{ background: C.surfaceAlt, borderBottom: ... }}>
  <div className="grid items-center"          ← grid uten bg, samme kolonner
       style={{ gridTemplateColumns: ..., height: 32, paddingLeft: 16, paddingRight: 16 }}>
    ...kolonner...
  </div>
</div>
```

## Hvorfor lav-risk

- Ren JSX-omstrukturering: ingen logikk, ingen state, ingen data, ingen kolonneendring.
- Sticky-oppførsel og høyde (32px) bevares 1:1.
- Gjelder kun de tre headerne — radene under er uendret.
- Reversibelt med samme grep.
- Identisk fix på alle tre flatene gir konsekvent visuelt resultat.

## Utenfor scope

- Radhøyder, kolonnebredder, sortering, filtre, scroll-oppførsel.
- Andre tabeller (Ansatte, Konsulenter, Markedsradar) — kan migreres senere ved behov.

