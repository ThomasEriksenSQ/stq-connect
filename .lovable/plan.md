
## Mål
Legge til Cmd+K-søkepalett (samme som på Kontakter/Selskaper) på:
- `/design-lab/foresporsler`
- `/design-lab/oppfolginger`

Og fjerne det vanlige søkefeltet i headeren på `/design-lab/oppfolginger` siden Cmd+K erstatter det.

## Funn
- `CommandPalette` (`src/components/designlab/CommandPalette.tsx`) er allerede en gjenbrukbar komponent som tar `contacts`, `companies`, og handlere for valg.
- **Forespørsler**: Har ingen synlig `DesignLabSearchInput` i header — kun en intern `search`-state brukt til filtrering. Cmd+K-handler i dag fokuserer en `searchRef` som ikke finnes i DOM (no-op).
- **Oppfølginger**: Har et synlig `DesignLabSearchInput` i headeren (linje 397–404) som skal fjernes. Ingen Cmd+K-handler i dag.
- **Kontakter** og **Selskaper** bruker `CommandPalette` med `cmdOpen`-state og en `keydown`-handler som åpner paletten på ⌘K/Ctrl+K.

## Plan

### 1. `src/pages/DesignLabForesporsler.tsx`
- Importer `CommandPalette`.
- Legg til `cmdOpen`-state.
- Endre eksisterende ⌘K-handler: i stedet for å fokusere `searchRef`, sett `setCmdOpen(true)`.
- Bygg `contacts`-liste og `companies`-liste fra `rows`:
  - `contacts`: unike kontakter fra `rows[].contacts` (med firstName, lastName, company = `selskap_navn`, companyId, email, phone, signal fra `signalByContactId`, daysSince fra `mottatt_dato`).
  - `companies`: unike selskaper basert på `selskap_navn` med `contactCount` = antall forespørsler. Bruker `selskap_id` hvis tilgjengelig, ellers en deterministisk nøkkel basert på navn.
- Wire opp paletten:
  - `onSelectContact(id)`: finn første rad med matching `contacts.id` og sett `setSelectedRowId`.
  - `onFilterByCompany(name)`: sett `search` til selskapsnavnet (filtrerer listen).
  - `onResetSearch`: nullstill `search`.
- Render `<CommandPalette ... />` nederst i komponenten (etter `</main>` / før closing `</div>`).

### 2. `src/pages/DesignLabOppfolginger.tsx`
- Importer `CommandPalette`.
- Legg til `cmdOpen`-state og en ⌘K `keydown`-handler som åpner paletten.
- **Fjern** synlig søk-blokk i headeren (linje 397–404: `<div className="flex items-center gap-2"><DesignLabSearchInput ... /></div>`). Behold `search`-state og filterlogikk — paletten bruker den indirekte via callbacks.
- Bygg `contacts`-liste og `companies`-liste fra `viewModels`/`tasks`:
  - `contacts`: hent fra `tasks[].contacts` (firstName, lastName, company fra `companies.name`, companyId, email, phone, signal fra `viewModel.signal`, daysSince=0).
  - `companies`: unike fra `tasks[].contacts.companies` + `tasks[].company_id` med `contactCount`.
- Wire opp paletten:
  - `onSelectContact(id)`: finn første task med matching `contact_id` og sett `setSelectedId(taskId)`.
  - `onFilterByCompany(name)`: sett `search` til navnet (filtrerer listen).
  - `onResetSearch`: nullstill `search` hvis satt.
- Render `<CommandPalette ... />` nederst.

## Filer som endres
- `src/pages/DesignLabForesporsler.tsx` — Cmd+K-palett wiring.
- `src/pages/DesignLabOppfolginger.tsx` — Cmd+K-palett wiring + fjerne synlig søkefelt.

## Utenfor scope
- Endringer i `CommandPalette`-komponenten.
- Endringer på andre Design Lab-sider.
- Endring av filterlogikk eller listevisning utover å koble inn paletten.
