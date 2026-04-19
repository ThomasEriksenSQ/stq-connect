
## Mål
Legg til `/design-lab/innstillinger` som egen rute, og pek tannhjul-knappen i Design Lab-sidebaren dit i stedet for V1-`/innstillinger`. V2-designet for Innstillinger eksisterer allerede.

## Funn
- `Innstillinger.tsx` har allerede en ferdig `InnstillingerV2`-komponent som bruker `DesignLabPageShell`, `SectionCard`, `DesignLabPrimaryAction/SecondaryAction`, `StatusDot` og `VarslingsInnstillingerV2`. Den gjengis i dag bare når `isV2Active === true` på V1-ruten `/innstillinger`.
- `DesignLabSidebar.tsx` linje 96: tannhjulet navigerer til `/innstillinger` (V1-ruten) — derfor blir man kastet ut av Design Lab når man klikker.
- `App.tsx` har ingen rute under `/design-lab/innstillinger`.

## Plan

1. **`src/pages/Innstillinger.tsx`**
   - Eksporter `InnstillingerV2` som egen named export (f.eks. `export function InnstillingerV2()`), slik at den kan importeres direkte fra Design Lab-ruten.
   - Behold `Innstillinger`-default-eksporten og V1/V2-bryteren uendret for `/innstillinger`-ruten (bakoverkompatibilitet).
   - I `InnstillingerV2`: endre `activePath="/innstillinger"` → `activePath="/design-lab/innstillinger"` slik at tannhjulet markeres som aktivt i sidebaren når man står på siden.

2. **`src/App.tsx`**
   - Legg til ny rute under `/design-lab`-blokken:
     ```tsx
     <Route path="innstillinger" element={<Suspense fallback={<LazyFallback/>}><DesignLabInnstillinger/></Suspense>} />
     ```
   - Lazy-importer `InnstillingerV2` som named export:
     ```tsx
     const DesignLabInnstillinger = lazy(() =>
       import("./pages/Innstillinger").then(m => ({ default: m.InnstillingerV2 }))
     );
     ```

3. **`src/components/designlab/DesignLabSidebar.tsx`**
   - Endre tannhjul-knappens `onClick` fra `navigate("/innstillinger")` → `navigate("/design-lab/innstillinger")`.
   - Endre `active={isActive("/innstillinger")}` → `active={isActive("/design-lab/innstillinger")}`.

## Effekt
- Ny rute `/design-lab/innstillinger` viser den eksisterende V2-Innstillinger-flaten med Design Lab-sidebar, header (40px) og samme grid (Outlook + Mailchimp + VarslingsInnstillingerV2).
- Tannhjulet i Design Lab-sidebaren navigerer internt og markeres aktivt — ingen utkasting fra Design Lab.
- V1-ruten `/innstillinger` fortsetter å fungere som før (med `isV2Active`-bryter for legacy).

## Utenfor scope
- Endring av selve V2-innstillingenes innhold/atferd (Outlook, Mailchimp, varslingsmottakere).
- Fjerning av V1-Innstillinger-ruten — den beholdes inntil videre.
