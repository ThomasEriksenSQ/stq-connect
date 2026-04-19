

## Funn

I `src/pages/KonsulenterOppdrag.tsx` rendres "Type"-kolonnen som en pille basert på `companyStatusMap[o.selskap_id]` (Sluttkunde/Partner/Potensiell/—). Det er feil — det er selskapets rolle, ikke oppdragets type. Riktig kilde er `o.deal_type` (`"DIR"` → "Direkte", `"VIA"` → "Via partner").

Feilen finnes på tre steder:
- Mobile cards (linje ~298–304): `kundeType` settes fra `companyStatusMap`.
- Embedded split-tabell (linje ~459–489): pille fra `companyStatusMap`.
- Standalone-tabell (linje ~645–672): samme pille fra `companyStatusMap`.

Header-rekkefølgen er allerede `… Sluttkunde, Via partner, Type, Utpris …`, så kolonnen Type er den fjerde — den skal vise oppdragets formidlingstype.

## Plan

### `src/pages/KonsulenterOppdrag.tsx`

**1. Embedded split-tabell (linje ~459–489)** — erstatt hele `<div>{(() => { const cs = … })()}</div>`-blokken med en enkel pille basert på `o.deal_type`:
- `o.deal_type === "VIA"` → "Via partner" (lys ravgul: `bg-amber-100 text-amber-700 border-amber-200`)
- ellers (default `"DIR"`) → "Direkte" (lys grå-blå nøytral: `bg-slate-100 text-slate-700 border-slate-200`)

Stil følger eksisterende pille-mønster: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold`.

**2. Standalone-tabell (linje ~645–672)** — identisk endring som over.

**3. Mobile cards (linje ~298–304)** — bytt `kundeType`-utregningen til:
```
const kundeType = o.deal_type === "VIA" ? "Via partner" : "Direkte";
```
Beholder samme visningssted i kortet (under konsulent/sluttkunde-meta).

### Utenfor scope
- Ingen endring i header-rekkefølge eller grid-template (kolonnene er allerede riktige).
- Ingen endring i "Sluttkunde"-kolonnen eller "Via partner"-kolonnen.
- Ingen DB- eller `oppdragForm`-endring.
- Ingen V1-endringer utenfor denne filen.

