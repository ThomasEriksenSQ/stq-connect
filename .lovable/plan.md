

## Fix: Innkjøper-chip design + forbudt-ikon

### Problem
Innkjøper-chipen bruker `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold` — avviker fra standard Chip-designet som bruker `CHIP_BASE` (`h-8 px-3 text-[0.8125rem] rounded-full border`).

### Endringer

**Fil: `src/pages/Contacts.tsx`**, linje 1566-1579:

Erstatt den egendefinerte `<button>` med samme `CHIP_BASE`/`CHIP_ON`/`CHIP_OFF`-klasser som de andre Chip-komponentene. Legg til et lite rødt forbudt-ikon (`Ban` fra lucide-react, size 14) foran teksten når `typeFilter === "not_call_list"`:

```tsx
<button
  className={`${typeFilter === "call_list" || typeFilter === "not_call_list" ? CHIP_ON : CHIP_OFF} inline-flex items-center gap-1.5`}
  onClick={() => {
    if (typeFilter === "call_list") setTypeFilter("not_call_list");
    else if (typeFilter === "not_call_list") setTypeFilter("all");
    else setTypeFilter("call_list");
  }}
>
  {typeFilter === "not_call_list" && <Ban className="w-3.5 h-3.5 text-red-500" />}
  {typeFilter === "not_call_list" ? "Ikke innkjøper" : "Innkjøper"}
</button>
```

Legg til `Ban` i lucide-react-importen.

Ingen andre endringer.

