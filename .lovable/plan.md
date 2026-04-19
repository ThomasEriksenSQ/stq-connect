

## Mål
Redusere mellomrommet mellom toppheaderen ("Markedsradar") og "Radar"-boksen på `/design-lab/markedsradar`, slik at det matcher tettheten på `/design-lab/stacq-prisen` og `/design-lab/konsulenter/oppdrag`.

## Årsak
Markedsradar (V1-komponent) gjenbrukes i Design Lab via `DesignLabPageShell`. Når `hidePageIntro` er på, skjules selve `<h1>`, men:
- Den ytre raden (`flex ... justify-between`) med Importer-knappen rendres fortsatt og tar plass.
- Root-divet bruker `space-y-6` (24px) mellom rad og Tabs.
- Tabs-komponenten har `mt-2` på `TabsContent` i tillegg.

Resultat: ~24px shell-padding + ~40-44px knapperad + 24px space-y + 8px tabs-mt → for stort gap.

## Endringer

**1. `src/pages/Markedsradar.tsx`**
- Når `hidePageIntro` er på (Design Lab-modus), flytt "Importer uke"-knappen inn i `headerRight` via et nytt prop `headerActions?: ReactNode` — eller enklere: skjul hele topprad-containeren i Design Lab-modus og la knappen rendres som en liten outline-knapp ved siden av Tabs-listen i samme rad.
- Reduser root-spacing i Design Lab-modus: bruk `space-y-3` istedenfor `space-y-6` når `designLabMode` er true.

**2. `src/pages/DesignLabMarkedsradar.tsx`**
- Send "Importer uke"-knappen via `headerRight`-prop på `DesignLabPageShell`, slik StacqPrisen-mønsteret tilsier (knapp i header-bar, ikke i innholdet).

## Visuell effekt
Før: header → 24px padding → 44px tom knapperad → 24px gap → Tabs → 8px → Radar-kort.
Etter: header (med Importer-knapp til høyre) → 24px padding → Tabs → 8px → Radar-kort.

Dette gir samme tetthet som StacqPrisen-siden uten å påvirke V1-ruten `/markedsradar`.

## Tekniske noter
- `designLabMode` finnes allerede som prop i `Markedsradar` — ingen ny API-overflate trengs der.
- `DesignLabPageShell` støtter allerede `headerRight`.
- V1-flaten `/markedsradar` får ingen endring siden `designLabMode` defaulter til `false`.

