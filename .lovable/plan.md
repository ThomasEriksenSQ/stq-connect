

## Plan: Standardiser dato-chips til samme størrelse som toggle-chips

### Endring

**Fil:** `src/components/dashboard/DailyBrief.tsx`

Dato-chipsene ("Følg opp på sikt", "1 uke", "2 uker" osv.) og date-inputen oppskaleres til samme stil som toggle-chipsene:

1. **Chip-knapper (linje 1037):** Endre `h-7 px-3 text-[0.75rem]` → `h-9 px-4 text-[0.8125rem]`. Endre inaktiv hover fra `hover:bg-primary/10 hover:text-primary hover:border-primary/30` → `hover:bg-secondary`.

2. **Date-input (linje 1059):** Endre `h-7 px-2 text-[0.75rem]` → `h-9 px-3 text-[0.8125rem]`. Endre inaktiv hover fra `hover:border-primary/30` → `hover:bg-secondary`.

