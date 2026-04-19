

## Mål
På `/design-lab/oppfolginger`: flytte "Ny oppfølging"-knappen fra høyre kant til **direkte til høyre for tekstskala-kontrollen (XXL)**.

## Funn
- I `src/pages/DesignLabOppfolginger.tsx` ligger knappen i en egen `div` med `ml-auto` som dytter den helt ut til høyre.
- `TextSizeControl` (XS … XXL) rendres av `DesignLabPageShell` via `headerRight`-propen — men denne siden bruker ikke `DesignLabPageShell`. Den har sin egen `<header>` der `TextSizeControl` ligger i `headerRight`-blokken sammen med andre headerelementer.

## Plan
1. Lese `DesignLabOppfolginger.tsx` rundt headeren for å finne nøyaktig hvor `TextSizeControl` rendres og hvor "Ny oppfølging"-Dialog ligger.
2. Flytte Dialog-blokken med "Ny oppfølging" inn i samme flex-container som `TextSizeControl`, plassert **etter** `TextSizeControl` (uten `ml-auto`), med liten `gap` for luft.
3. Fjerne den nå tomme høyre-divven (`ml-auto`-wrapperen).

## Fil som endres
- `src/pages/DesignLabOppfolginger.tsx` — kun header-layout (rekkefølge/wrappere). Ingen logikkendringer.

## Utenfor scope
- Endring av `TextSizeControl` eller `DesignLabPrimaryAction`-styling.
- Endringer på andre Design Lab-sider.
- Endre Dialog-innhold eller "Ny oppfølging"-funksjonalitet.

