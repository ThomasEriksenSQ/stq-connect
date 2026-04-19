
## Mål
Vis en hjelpetekst i det tomme høyre-panelet på `/design-lab/kontakter` og `/design-lab/selskaper`, tilsvarende "Velg en ansatt for å vise profil." på Ansatte. Teksten skal informere om Cmd+K-snarveien.

## Funn
- **Ansatte** (`DesignLabKonsulenterAnsatte.tsx` linje 447–456): Empty state har sentrert tekst i `C.textFaint`, 13px.
- **Selskaper** (`DesignLabCompanies.tsx` linje 645–647): Empty panel er bare en tom div (`<div className="h-full" ... />`) — ingen tekst.
- **Kontakter** (`DesignLabContacts.tsx` linje 2441–2443): Samme — tom div, ingen tekst.

## Plan
Erstatt den tomme div-en i begge filer med samme mønster som Ansatte:

**`src/pages/DesignLabContacts.tsx`** (linje 2441–2443):
```tsx
) : (
  <div
    className="flex h-full items-center justify-center"
    style={{ borderLeft: `1px solid ${C.borderLight}`, background: C.appBg }}
  >
    <p style={{ fontSize: 13, color: C.textFaint }}>
      Trykk ⌘K for å søke.
    </p>
  </div>
)}
```

**`src/pages/DesignLabCompanies.tsx`** (linje 645–647): identisk endring.

Bruker `⌘K` (Mac-symbol) for å matche Linear-stilen i Design Lab — kortere og renere enn "Cmd + K". Beholder samme typografi (13px, `C.textFaint`) som Ansatte for konsistens.

## Effekt
- Tomt panel på Kontakter og Selskaper viser nå en diskret hjelpetekst sentrert vertikalt og horisontalt.
- Visuelt og tonemessig identisk med eksisterende Ansatte-empty-state.

## Utenfor scope
- Endring av Ansatte-teksten.
- Andre flater (Forespørsler, Oppfølginger, etc.).
