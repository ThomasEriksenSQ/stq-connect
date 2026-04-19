
## Mål
Redusere mellomrommet mellom toppmenyen ("Markedsradar"-tittelen i shell-headeren) og Radar-/Annonser-/AI-tabboksen, slik at den matcher tettheten på Aktive oppdrag og Ansatte-sidene.

## Funn
- `DesignLabPageShell` har samme topp-padding (`24px`) på alle tre sidene. Det er ikke kilden til forskjellen.
- På **Aktive oppdrag** ligger "Nytt oppdrag"-knappen i shell-headerens `headerRight`. Innholdet starter rett etter shell-paddingen.
- På **Markedsradar** rendres "Importer uke"-knappen i en egen rad inne i `Markedsradar.tsx` (`<div className="flex justify-end">`) over `<Tabs>`. Det legger til ca. 32px knappehøyde + 12px (`space-y-3`) gap **før** tab-listen vises.
- Resultat: Radar-boksen ligger ~44px lavere enn på Aktive oppdrag/Ansatte.

## Løsning
Flytt "Importer uke"-knappen fra `Markedsradar`-innholdet til `DesignLabMarkedsradar`-shellens `headerRight`, samme mønster som `DesignLabKonsulenterOppdrag`.

### Endringer

**1. `src/pages/Markedsradar.tsx`**
- Eksponer en mekanisme for å åpne import-modalen utenfra (samme mønster som `createRequestId` i `KonsulenterOppdrag`).
  - Legg til prop: `importRequestId?: number`.
  - `useEffect` som setter `setImportOpen(true)` når `importRequestId > 0` endres.
- Når `designLabMode === true`: ikke render den interne knapperaden (linje 167–173). Behold V1-headeren uendret for `/markedsradar`.
- Endre rot-wrapperen fra `space-y-3` til ingen vertikal spacing (bare Tabs på toppnivå) når `designLabMode`, eller behold `space-y-3` siden den nå kun gjelder mellom Tabs og evt. ImportModal (modal har ingen layout-innvirkning, så det er trygt å beholde — men vi kan også sette `space-y-0` for å være eksplisitt).

**2. `src/pages/DesignLabMarkedsradar.tsx`**
- Hold lokal state `importRequestId` (counter, samme mønster som `DesignLabKonsulenterOppdrag`).
- Send `headerRight` til `DesignLabPageShell` med en `DesignLabPrimaryAction` (sekundærvariant via `outline`, eller behold den eksisterende `outline`-stilen — match det som brukes på Aktive oppdrag for visuell konsistens).
  - Bruker `Download` ikon + "Importer uke".
- Ved klikk: `setImportRequestId((n) => n + 1)`.
- Send `importRequestId` videre til `<Markedsradar />`.

### Visuell konsistens
Aktive oppdrag bruker `DesignLabPrimaryAction` (accent-fylt). Markedsradar har i dag en `outline`-knapp. Forslag: bruk `DesignLabPrimaryAction` for å matche stilen på Aktive oppdrag eksakt, slik at headerRight-knappene ser like ut på tvers av sidene.

## Effekt
Radar-boksen flyttes opp ca. 44px og lander på samme høyde som tabellene på Aktive oppdrag og Ansatte. Funksjonalitet (importflyt, modalåpning) er uendret.

## Utenfor scope
- Ingen endring i V1 `/markedsradar`-headeren eller layouten.
- Ingen endring i tab-innhold, kort eller filtre.
- Ingen endring i `DesignLabPageShell`-paddingen.
