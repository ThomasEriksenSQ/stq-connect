

## Fix: Lukk Signal-menyen ved klikk utenfor

### Endring

**Fil: `src/components/dashboard/DailyBrief.tsx`**

Legg til en usynlig overlay `<div>` rett før Signal-dropdown-menyen (linje ~1091) som dekker hele skjermen og lukker menyen ved klikk:

```tsx
{activeForm === "signal" && (
  <>
    <div className="fixed inset-0 z-40" onClick={() => setActiveForm(null)} />
    <div className="absolute top-full left-0 mt-1 z-50 ...">
      ...
    </div>
  </>
)}
```

Ingen andre endringer.

