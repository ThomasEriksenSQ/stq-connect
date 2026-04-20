

## Endring i `src/pages/DesignLabForesporsler.tsx`

### Problem
Konsulent-navn (f.eks. "Tom Erik Lundesgaard") flyter ut av Konsulent-kolonnen og overlapper Status-kolonnen. Eksisterende `truncate`-klasse på navn-span (linje 701) får ikke effekt fordi:
- ytre kolonne-wrapper (linje 666) mangler `min-w-0` / `overflow: hidden`
- indre rad-wrapper (linje 679) mangler `min-w-0` og navne-spanen har ingen `flex: 1` / `minWidth: 0` for å begrense bredden

I CSS grid + flexbox må alle nivåer i kjeden ha `min-width: 0` for at `text-overflow: ellipsis` skal virke.

### Fiks (3 små justeringer i samme blokk, linje 666–704)

1. **Ytre kolonnewrapper** (linje 666) — legg til `min-w-0` og `overflow: hidden`:
```tsx
<div className="flex flex-col items-start gap-2 pr-8 min-w-0" style={{ paddingTop: 2, overflow: "hidden" }}>
```

2. **Indre per-konsulent rad** (linje 679) — gjør den til full bredde med `min-w-0`:
```tsx
<div key={k.id} style={{ minHeight: 32, display: "flex", alignItems: "center", gap: 12, width: "100%", minWidth: 0 }}>
```

3. **Navne-span** (linje 701) — la den fylle gjenværende bredde og trunkere:
```tsx
<span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.2, flex: "1 1 auto", minWidth: 0 }}>
  {navn}
</span>
```

Avataren har allerede `flexShrink: 0`, så ikon beholder full størrelse mens navnet får ellipsis.

### Resultat
- "Tom Erik Lundesgaard" vises som "Tom Erik Lundes…" når kolonnen er smal, og fullt navn når plass tillater det.
- Status-kolonnen overlapper ikke lenger med navnet.
- Ingen endring i radhøyde, avatar-størrelse, eller layout for andre kolonner.
- Tooltip-fri (kan legges til som senere forbedring om ønsket — ikke i scope nå).

### Ikke endret
- Grid-template-kolonner (`cols`), filter-rad, header.
- Standard Foresporsler-side (V1).
- Logikk for henting/visning av konsulenter.

