

## Mål
Eksponere `/innstillinger` (V2-rendringen) som en navigerbar lenke i Design Lab-sidebaren, slik at den er tilgjengelig fra `/design-lab/*`-flatene.

## Funn
- `Innstillinger.tsx` håndterer allerede V1/V2-rendring via `useDesignVersion()` — V2 bruker `DesignLabPageShell` med `activePath="/innstillinger"`.
- Ruten `/innstillinger` finnes allerede i `App.tsx` og fungerer for begge versjoner. Ingen ny rute trengs.
- `DesignLabSidebar.tsx` er sannhetskilden for navigasjon i alle Design Lab-flater. Sjekker hvilke nav-items som finnes der i dag for å plassere "Innstillinger" på naturlig sted (sannsynligvis nederst, ved siden av profil/logg ut).

## Endring

**`src/components/designlab/DesignLabSidebar.tsx`**
- Legg til et nytt nav-item "Innstillinger" som peker på `/innstillinger`.
- Bruk `Settings`-ikonet fra `lucide-react`.
- Plasseres nederst i sidebaren (over eller ved siden av bruker/logg ut-blokken) — matcher V2-konvensjonen om at innstillinger ligger i bunnen.
- Aktiv-tilstand fungerer automatisk siden `DesignLabPageShell` allerede sender `activePath="/innstillinger"`.

## Effekt
- Brukere på V2-flatene (`/design-lab/*`) kan navigere direkte til Innstillinger fra sidebaren, og siden rendres med V2-design (allerede implementert).
- Ingen ny rute opprettes — eksisterende `/innstillinger` brukes.
- V1 og V1-sidebar er uendret.

## Utenfor scope
- Ingen ny `/design-lab/innstillinger`-rute (V2-bryteren på `/innstillinger` håndterer rendering).
- Ingen endringer i `Innstillinger.tsx` eller `VarslingsInnstillingerV2.tsx`.
- Ingen endring i V1 `AppSidebar` eller toppmeny.

