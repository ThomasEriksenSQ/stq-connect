
## Plan: Avrund margin til 2 desimaler

### Endring i `src/pages/AnsattDetail.tsx`

**Linje 702**: Endre `{margin}` til `{margin.toFixed(2)}` i margin-visningen:

```tsx
{margin != null && <span className="text-muted-foreground">Margin: <span className="font-medium text-emerald-600">{margin.toFixed(2)} kr</span></span>}
```

Kun én linje endres.
