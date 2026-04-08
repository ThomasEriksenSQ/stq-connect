

## Plan: Konsistent dato-styling for Siste og Neste oppfølging

### Problem
Datoene på «Siste oppfølging» og «Neste oppfølging» bruker `text-[0.75rem]` med ulik fargekoding. Designsystemet definerer allerede **Meta/dato tekst** som `text-[0.8125rem] text-muted-foreground`.

### Endringer

**Fil:** `src/components/dashboard/DailyBrief.tsx`

1. **Siste oppfølging dato (linje 893):** Endre `text-[0.75rem]` → `text-[0.8125rem]`. Behold ageColor på relativ tekst og `text-muted-foreground` på absolutt dato.

2. **Neste oppfølging dato (linje 964):** Endre `text-[0.75rem]` → `text-[0.8125rem]`. Behold betinget farge (destructive for forfalt, muted-foreground ellers).

Begge datoer får dermed identisk størrelse (`text-[0.8125rem]`) og bruker `text-muted-foreground` som basisfarge — i tråd med designsystemets meta/dato-spesifikasjon.

