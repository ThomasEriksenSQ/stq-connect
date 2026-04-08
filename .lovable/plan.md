

## Plan: Bedre kolonnebredder og "Se profil"-knapp

### Endringer i `src/pages/KonsulenterAnsatte.tsx`

**1. Oppdater grid-kolonner (linje 25)**

Fra: `grid-cols-[minmax(0,2.2fr)_95px_100px_90px_80px_40px]`
Til: `grid-cols-[minmax(0,2.5fr)_100px_110px_100px_90px_90px]`

Gir mer plass til NAVN-kolonnen og jevnere fordeling. Siste kolonne utvides for å romme en tekstknapp.

**2. Erstatt ikon-knapp med "Se profil"-knapp (linje 341–348)**

Bytt ut det lille User-ikonet med en tekstknapp:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); navigate(`/konsulenter/ansatte/${a.id}`); }}
  className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted-foreground hover:text-foreground transition-colors"
>
  Se profil
</button>
```

Fjern `User`-ikonet fra imports (hvis ikke brukt andre steder).

### Kun én fil endres
- `src/pages/KonsulenterAnsatte.tsx`

