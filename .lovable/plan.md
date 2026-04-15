

# Plan: Signal-farge border-top på kontaktkortet i Design Lab

## Summary
Add a 2px colored `border-top` to the contact card panel in `DesignLabContacts.tsx`, using the selected contact's signal color from `SIGNAL_COLORS`.

## Technical Detail

**File:** `src/pages/DesignLabContacts.tsx` — line ~593

Current container `div` for the contact card:
```tsx
<div className="h-full flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
```

Add `borderTop` using `SIGNAL_COLORS[sel.signal].color`:
```tsx
<div className="h-full flex flex-col" style={{
  background: C.panel,
  borderLeft: `1px solid ${C.borderLight}`,
  borderTop: `2px solid ${SIGNAL_COLORS[sel.signal].color}`,
}}>
```

This gives immediate signal context — green for "Behov nå", amber for "Får kanskje behov", etc. — without breaking the clean white panel aesthetic.

**One line changed. No other files affected.**

