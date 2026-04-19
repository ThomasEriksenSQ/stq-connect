
## Mål
Omorganiser kolonner i Forespørsler-tabellen (Design Lab), legg til Signal-kolonne, og match stylen på Kontakt og Selskap til hvordan de samme tingene vises i Kontakter-tabellen.

## Ny kolonne-rekkefølge
| # | Kolonne | Kilde | Stil |
|---|---|---|---|
| 1 | **Kontakt** | `row.contacts.first_name + last_name` | 13px / 500 / `C.text` (samme som "Navn" i Kontakter) |
| 2 | **Signal** | Utledet via `getEffectiveSignal(activities, tasks)` per kontakt | `DesignLabSignalBadge` (samme komponent som Kontakter) |
| 3 | **Selskap** | `row.selskap_navn` | 12px / `C.textMuted` (samme som "Selskap"-kolonnen i Kontakter, ikke fet) |
| 4 | **Type** | `row.type` | `TypeChip` (uendret) |
| 5 | **Teknologier** | `row.teknologier` | `DesignLabReadonlyChip` (uendret) |
| 6 | **Konsulent** | `foresporsler_konsulenter` | Avatar + navn (uendret) |
| 7 | **Status** | Pipeline-status per konsulent | Status-pill (uendret) |
| 8 | **Mottatt** | `row.mottatt_dato` via `relTime(days)` | 13px / 500 + fargekoder (uendret stil, ny posisjon) |

## Endringer

### 1. Henting av Signal per kontakt
I `useQuery` i `DesignLabForesporsler.tsx`:
- Samle alle unike `contact_id` fra `rows` etter at hovedspørringen er ferdig.
- Legg til en ny `useQuery` som henter `activity_log` og `tasks` for disse kontaktene.
- Bygg et `signalByContactId: Map<string, string>` ved å kjøre `getEffectiveSignal(activities, tasks)` per kontakt (samme mønster som i `DesignLabContacts.tsx` linjer 739–757).

### 2. `TableHeader` (linje 423–447)
Ny kolonnedefinisjon:
```
"minmax(180px,1.3fr) 132px minmax(180px,1.2fr) 88px minmax(180px,1.05fr) minmax(190px,1.15fr) minmax(120px,0.85fr) 92px"
```
Rekkefølge på `<DesignLabColumnHeader>`/spans: Kontakt → Signal → Selskap → Type → Teknologier → Konsulent → Status → Mottatt.

Sortering:
- "Kontakt" → `field="kontakt"` (allerede definert i `SortField`)
- "Signal" → ny `field="signal"` (legg til i `SortField` + sort-switch som sorterer på Signal-rangering tilsvarende `SIGNAL_ORDER` fra Kontakter)
- "Selskap" → `field="selskap_navn"`
- "Status" → `field="sendt_count"` (uendret)
- "Mottatt" → `field="mottatt_dato"` (uendret)

### 3. `ForespRow` (linje 449–596)
Samme nye `cols` som header. Send `signalByContactId` inn som prop og slå opp med `row.contacts?.id`.

Render-rekkefølge:
1. **Kontakt**: `<span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>` med `kontaktNavn`. Hvis ingen kontakt: `—` i `C.textGhost`.
2. **Signal**: `signal ? <DesignLabSignalBadge signal={signal} /> : <span style={{ fontSize: 11, color: C.textGhost }}>—</span>` (samme mønster som Kontakter linje 2293–2299).
3. **Selskap**: `<span className="block truncate" style={{ fontSize: 12, color: C.textMuted }}>{row.selskap_navn}</span>` (matcher Kontakter linje 2313).
4. **Type / Teknologier / Konsulent / Status**: uendret blokker, bare flyttet i rekkefølge.
5. **Mottatt**: eksisterende `relTime(days)`-span med fargekoder, flyttet til sist.

### 4. Imports
Legg til i `DesignLabForesporsler.tsx`:
- `DesignLabSignalBadge` fra `@/components/designlab/system`
- `getEffectiveSignal`, `normalizeCategoryLabel` fra `@/lib/categoryUtils`

## Utenfor scope
- Ingen endring i filtre, stat-linje, header eller detaljpanel.
- Ingen endring i V1 `/foresporsler`.
- Ingen endring i kolonneoverskrift-stilen (allerede standardisert i forrige runde).
