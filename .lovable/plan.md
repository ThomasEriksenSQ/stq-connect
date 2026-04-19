

## Funn

`KonsulenterOppdrag.tsx` har én tabell-grid (`OPPDRAG_GRID_TEMPLATE`) som rendres to ganger: i `embeddedSplit`-modus (linje ~398) og standalone-modus (linje ~585). Header-strengen `["Konsulent", "Kunde", "Type", "Utpris", "Margin", "Margin %", "Forny", "Status"]` finnes begge steder. `partner_navn` ligger allerede på rad-objektet fra `select("*")` etter forrige iterasjon.

Mobile cards (linje 295) er kompakte og vises kun under `md` — der utelater vi partner for å holde det rent (uendret).

## Plan

### 1. `src/pages/KonsulenterOppdrag.tsx`

**Grid-template** — utvid med én kolonne for partner rett etter Kunde:
```
const OPPDRAG_GRID_TEMPLATE =
  "minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,1fr) 80px 90px 96px 72px 100px 90px";
```

**Header-array** (begge steder) — sett inn `"Via partner"` etter `"Kunde"`:
```
["Konsulent", "Kunde", "Via partner", "Type", "Utpris", "Margin", "Margin %", "Forny", "Status"]
```

**Cell** (begge tabell-render-blokker, embedded + standalone) — ny celle rett etter Kunde-cellen:
- Hvis `o.deal_type === "VIA"` og `o.partner_navn` finnes: vis navn som `text-[0.8125rem] text-muted-foreground truncate`.
- Ellers: vis dempet `—` (`text-muted-foreground`).

Ingen visning på mobile cards (kompakt visning forblir uendret).

### 2. Utenfor scope
- Ingen filter/gruppering på partner.
- Ingen endring i `OppdragEditSheet` eller `oppdragForm`.
- Ingen DB-endring (kolonnene ble lagt inn forrige iterasjon).
- Ingen endring i V1-flater utenfor denne siden.

