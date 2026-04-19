

## Mål
Gjøre tekststørrelse-velgeren i sidebar-footeren proft og diskret:
- Bring tilbake `T`-ikonet (Type fra lucide) som label-erstatning — ingen "Tekststørrelse"-tekst.
- Flytt hele velger-raden **over** den horisontale streken (borderTop) som skiller footer fra navigasjon, slik at den visuelt grupperes med navigasjonen og ikke konkurrerer med Innstillinger/Logg ut.
- Stram opp pill-radens proporsjoner og spacing.

## Funn
- I `DesignLabSidebar.tsx` ligger velgeren nå **inne i** footer-blokken (etter `borderTop`), like over `Innstillinger`. Det føles tungt og bryter rytmen.
- `TextSizeControlSidebar` i `TextSizeControl.tsx` har label "Tekststørrelse" + pill-rad, ingen ikon.
- Den allerede eksisterende `TextSizeControl` (ikke-sidebar) bruker `Type`-ikonet fra lucide foran pillene — samme mønster vi vil ha tilbake.

## Designvalg

**Plassering:** Flytt velgeren ut av footer-blokken. Render den som siste element i `<nav>`-blokken (eller rett etter `</nav>`, før footer-`<div>`-en med `borderTop`). Da havner den over den horisontale streken, gruppert med navigasjon, mens Innstillinger/Logg ut beholder sin rene system-gruppe under streken.

**Layout:**
```
[ T ]   [S][M][L][XL][XXL]
```
- Venstre: `Type`-ikon (14px, `C.textFaint`, strokeWidth 1.5), ingen tekstlabel.
- Høyre: kompakt pill-rad, høyrejustert via `justify-between`.
- Rad-høyde 28px (matcher NavGroup-rytme).
- Horisontal padding `px(10)` venstre / `px(8)` høyre — matcher nav-radene.
- Pills: `minWidth: 22`, `paddingInline: 4`, `fontSize: 11` — samme som nåværende sidebar-variant.
- Bunnmargin `px(6)` for å puste mot `borderTop` under.
- Skjul fortsatt helt i `collapsed` modus (ikke meningsfullt på 48px).

**Hvorfor over streken:** Streken er en gruppe-separator — alt under er "system/konto" (Innstillinger, Logg ut, brukerprofil, kollaps-toggle). Tekststørrelse er en lese-preferanse som tilhører selve appens visning, ikke kontoen. Plassering rett over streken — som en stillegående utvidelse av nav — er proft og hierarkisk korrekt.

## Plan

1. **Oppdater `TextSizeControlSidebar` i `TextSizeControl.tsx`:**
   - Fjern "Tekststørrelse"-tekst.
   - Legg inn `<Type size={13} color={C.textFaint} strokeWidth={1.5} />` til venstre.
   - Behold `justify-between` så pill-raden flyter til høyre.
   - Behold pill-stilen (minWidth 22, fontSize 11, paddingInline 4).

2. **Oppdater `DesignLabSidebar.tsx`:**
   - Flytt `<TextSizeControlSidebar>`-blokken ut av footer-`<div>`-en.
   - Plasser den rett **etter** `</nav>` og **før** footer-`<div>` med `borderTop`. Wrap i en liten `<div>` med `paddingInline: px(12)` (matcher nav) og `paddingBottom: px(8)`.
   - Fjern den nåværende plasseringen i footer-blokken.

## Filer som endres
- `src/components/designlab/TextSizeControl.tsx` — sidebar-variant: T-ikon i stedet for tekst.
- `src/components/designlab/DesignLabSidebar.tsx` — flytt blokken over `borderTop`.

## Utenfor scope
- Endring av selve skala-verdiene, persistens, eller pill-komponenten.
- Synlighet i kollapset modus.

