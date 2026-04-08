

## Plan: Blå "Se profil"-knapp

### Endring i `src/pages/KonsulenterAnsatte.tsx`

Erstatt den nåværende tekst-lenken med en styled knapp:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); navigate(`/konsulenter/ansatte/${a.id}`); }}
  className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
>
  Se profil
</button>
```

### Kun én fil endres
- `src/pages/KonsulenterAnsatte.tsx`

