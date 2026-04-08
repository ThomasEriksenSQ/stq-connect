

## Plan: Lukk overlayen etter lagring i redigeringsmodus

### Problem
Når `AnsattDetailSheet` åpnes med `openInEditMode={true}`, og brukeren lagrer, kjøres `setEditing(false)` (linje 269). Dette viser "Finn oppdrag"-innholdet i stedet for å lukke overlayen.

### Løsning i `src/components/AnsattDetailSheet.tsx`

Endre linje 266–270: Hvis `openInEditMode` er `true`, kall `onClose()` etter lagring i stedet for `setEditing(false)`.

```ts
if (isCreate || openInEditMode) {
  onClose();
} else {
  setEditing(false);
}
```

Samme logikk for "Avbryt"-knappen (linje 574–578) — hvis `openInEditMode`, kall `onClose()`.

### Kun én fil endres
- `src/components/AnsattDetailSheet.tsx`

