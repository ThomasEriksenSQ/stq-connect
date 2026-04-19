
## Mål
Bytte den lilla aksentfargen `#5E6AD2` til den blå `#2563EB` (samme blå som vises på `/design-lab/stilark`-knappene) — **kun på knapper**. Ikke endre fokus-ringer, resize-håndtak, prikker eller avhukingsbokser.

## Funn
"Stilark"-knappen får sin blåfarge fra `DesignLabActionButton` (variant `primary`) i `src/components/designlab/controls.tsx`:
- background `#2563EB`, hover `#1D4ED8`.

Lilla knapper i CRMet finnes to steder:

**1. `src/components/design/DesignVersionToggle.tsx` (linje 24–28)**
Den faste V1/V2-veksleknappen nederst til høyre:
```
bg-[#5E6AD2]  hover:bg-[#4F5AB8]  focus:ring-[#5E6AD2]
```

**2. `src/index.css` linje 273–280**
CSS-regel som overstyrer V1-primærknapper til lilla når de rendres inne i en `.dl-v8-theme`-container (gjelder "Logg samtale", "Logg møtereferat", "Ny kontakt"-knapper inne i V2-paneler/sheets):
```css
.dl-v8-theme button[class*="bg-primary"][class*="text-primary-foreground"]:not([role="checkbox"]) {
  background-color: #5E6AD2;
  ...
}
```
I tillegg gjør linje 209–211 grønn "Logg samtale" om til primærfarge (`hsl(var(--primary))`), som så overstyres til lilla av regelen over.

## Endringer

**1. `src/components/design/DesignVersionToggle.tsx`**
- `bg-[#5E6AD2]` → `bg-[#2563EB]`
- `hover:bg-[#4F5AB8]` → `hover:bg-[#1D4ED8]`
- `focus:ring-[#5E6AD2]` → `focus:ring-[#2563EB]`

**2. `src/index.css` (linje 274–280)**
- `background-color: #5E6AD2;` → `background-color: #2563EB;`
- (Hover-tilstand legges til hvis ønsket — ellers beholdes nåværende oppførsel.)

## Utenfor scope (forblir `#5E6AD2`)
- Fokus-ringer på input-felter (`focus-visible:border-[#5E6AD2]`)
- Resize-håndtak når aktiv (`data-[resize-handle-active]:bg-[#5E6AD2]`)
- Avkrysningsboks-indikator i `ContactCardContent` (`data-[state=checked]:bg-[#5E6AD2]`) — ikke en knapp
- Prikk-indikatorer (`C.dotInfo`), tag-tekstfarger, owner-badge tekst, theme tokens i `src/theme.ts`
- `DesignLabPrimaryAction` — er allerede blå (`#2563EB`), ingen endring

## Effekt
V1/V2-veksleren og alle V1-primærknapper som rendres inne i V2-paneler (Logg samtale, Logg møtereferat, Ny kontakt osv.) blir blå `#2563EB` — visuelt konsistent med stilark-knappene. Andre lilla aksenter (fokus, resize, checkbox, prikker) forblir uendret.
