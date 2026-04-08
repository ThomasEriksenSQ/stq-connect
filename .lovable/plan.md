

## Plan: Standardiser inaktiv chip-stil i Sone 4

### Endring

**Fil:** `src/components/dashboard/DailyBrief.tsx`

Alle fire toggle-chips i Sone 4 (Signal, Innkjoper, CV-epost, Ikke relevant person) skal bruke identisk inaktiv stil. Innkjoper-knappens inaktive stil er malen:

```
bg-background text-muted-foreground border-border hover:bg-secondary
```

Aktivert-stil forblir unik per chip (sine respektive farger).

Konkrete linjer:

1. **Signal-knappen (linje 1086):** Allerede korrekt — `bg-background text-muted-foreground border-border hover:bg-secondary`.

2. **Innkjoper (linje 1158):** Allerede korrekt — dette er malen.

3. **CV-epost (linje 1189):** Allerede korrekt — `bg-background text-muted-foreground border-border hover:bg-secondary`.

4. **Ikke relevant person (linje 1215):** Endre fra `border-border text-muted-foreground hover:bg-secondary` til `bg-background text-muted-foreground border-border hover:bg-secondary` — mangler `bg-background`.

Alle fire har allerede `h-9 px-4 rounded-full border text-[0.8125rem] font-medium transition-colors` som baseklasser, så de matcher i storrelse og form. Eneste faktiske endring er a legge til `bg-background` pa "Ikke relevant person"-knappens inaktive tilstand.

