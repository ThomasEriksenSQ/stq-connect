

## Mål
Standardisere kolonneoverskriftene i alle V2 Design Lab-tabeller til samme "sannhet" som "Aktive oppdrag" og "Eksterne" (som per skjermbildet er fasit): **11px / font-weight 500 / UPPERCASE / letter-spacing 0.08em / farge `C.textMuted`**.

## Sannhet (referanse)
Fra `KonsulenterOppdrag.tsx` (linje 403–409) og `EksterneKonsulenter.tsx` (linje 248):
```
text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground
```
= `fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textMuted`

## Funn — avvik mot sannheten

| Tabell | Komponent / fil | Nåværende stil | Avvik |
|---|---|---|---|
| Aktive oppdrag | `KonsulenterOppdrag.tsx` | 11/500/UPPER/0.08em | ✅ sannhet |
| Eksterne | `EksterneKonsulenter.tsx` | 11/500/UPPER/0.08em | ✅ sannhet |
| Ansatte | `DesignLabKonsulenterAnsatte.tsx` | 11/500/UPPER/**0.04em** | letter-spacing for tett |
| Selskaper | `DesignLabCompanies.tsx` via `DesignLabColumnHeader` | 11/500/**ingen uppercase**/0.01em | mangler uppercase + spacing |
| Kontakter | `DesignLabContacts.tsx` via `DesignLabColumnHeader` | 11/500/**ingen uppercase**/0.01em + "Finn" på `C.textFaint` | mangler uppercase + spacing |
| Forespørsler | `DesignLabForesporsler.tsx` via `DesignLabColumnHeader` + spans (0.04em) | blandet | mangler uppercase, blandet spacing |
| Stacq Prisen | `DesignLabStacqPrisen.tsx` via `DesignLabColumnHeader` + `thStyle` (0.04em) | blandet | mangler uppercase, blandet spacing |

Brukeren sier også at Ansatte "ser ut til å være korrekt" — men målt mot Aktive oppdrag/Eksterne er den marginalt for tett (0.04em vs 0.08em). Jeg justerer Ansatte og alle de andre opp til 0.08em så alt matcher 100 %.

## Endringer

**1. `src/components/designlab/system/table.tsx` — `DesignLabColumnHeader`**
Endre stil til sannheten:
- `fontSize: 11`
- `fontWeight: 500` (også når aktiv — drop 600)
- `letterSpacing: "0.08em"`
- `textTransform: "uppercase"`
- `color: C.textMuted` (også når aktiv)

Dette løfter Selskaper, Kontakter, Forespørsler og Stacq Prisen automatisk siden alle bruker denne komponenten.

**2. `src/pages/DesignLabStacqPrisen.tsx`**
Oppdater `thStyle` (linje 363–365):
```ts
const thStyle = { fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted };
```

**3. `src/pages/DesignLabForesporsler.tsx`** (linje 441–443)
Endre de tre inline `<span>` for "Type", "Teknologier", "Konsulent" fra 0.04em til 0.08em + `textTransform: "uppercase"`.

**4. `src/pages/DesignLabContacts.tsx`** (linje 2242)
Endre "Finn"-spanet fra `color: C.textFaint` uten uppercase til samme stil som de andre overskriftene (11/500/UPPER/0.08em/`C.textMuted`).

**5. `src/pages/DesignLabKonsulenterAnsatte.tsx`** (linje 401–408)
Endre `letterSpacing: "0.04em"` → `"0.08em"`.

## Visuell effekt
Alle Design Lab-tabellene får samme overskriftsstil som "Aktive oppdrag" og "Eksterne" på skjermbildet: jevn UPPERCASE, 11px, lett demped grå, samme letter-spacing.

## Utenfor scope
- Ingen endring i radhøyder, kolonnebredder eller datacelle-styling.
- V1-flatene (`/markedsradar`, `/kontakter`, `/selskaper` osv.) er allerede på sannheten der det gjelder; ingen endring der.
- Ingen endring av sortering/funksjonalitet i `DesignLabColumnHeader`.

