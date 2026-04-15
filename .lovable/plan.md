

# Plan: Unik farge per signal i Design Lab

## Problem
Alle signaler i dropdown-menyen og signal-chipen bruker samme lilla accent-farge (`is-signal` → `#5E6AD2`). Det gjør det vanskelig å raskt skille mellom signaltyper.

## Løsning
Bruk `SIGNAL_COLORS` fra `theme.ts` (som allerede har unike farger per signal) til å style hver signal individuelt — både i dropdown-menyen og på trigger-chipen.

Fargekart (allerede definert i theme.ts):
- **Behov nå** → Grønn (`#2D6A4F` på `rgba(45,106,79,0.08)`)
- **Får fremtidig behov** → Blå (`#1A4FA0` på `rgba(26,79,160,0.08)`)
- **Får kanskje behov** → Amber (`#7D4E00` på `rgba(125,78,0,0.08)`)
- **Ukjent om behov** → Grå (`#8C929C` på `rgba(0,0,0,0.04)`)
- **Ikke aktuelt** → Rød (`#8B1D20` på `rgba(139,29,32,0.08)`)

## Endringer i `src/components/ContactCardContent.tsx`

### 1. Trigger-knappen (linje ~747)
Erstatt `chip chip--action is-signal` med inline styles fra `SIGNAL_COLORS[signalCat.label]`:
```tsx
<button
  className="chip chip--action cursor-pointer"
  style={{
    background: SIGNAL_COLORS[signalCat.label]?.bg,
    color: SIGNAL_COLORS[signalCat.label]?.color,
    border: "none",
  }}
>
```

### 2. Dropdown-items (linje ~767-771)
Erstatt `chip chip--action is-signal` med per-signal inline styles:
```tsx
<span
  className="chip chip--action"
  style={{
    background: SIGNAL_COLORS[cat.label]?.bg,
    color: SIGNAL_COLORS[cat.label]?.color,
    border: "none",
  }}
>
```

### 3. Import
Legg til import av `SIGNAL_COLORS` fra `@/components/designlab/theme` (linje ~1).

### Filer som endres
- `src/components/ContactCardContent.tsx` — 3 steder (import + trigger + dropdown items)

