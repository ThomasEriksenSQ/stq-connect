

## Plan: Re-import Salesforce-data med navnebasert matching

### Bakgrunn
Første import brukte Salesforce ID-mapping som feilet for mange poster. Nå har vi 4 filer:
1. **Accounts** (selskaper) - ~555 rader
2. **Contacts** (kontakter) - ~1184 rader  
3. **Activities with Contacts** (original eksport) - ~816 rader med SF-ID'er
4. **"Lovable sin request import"** (ny eksport) - ~816 rader med Task Subtype/Event Subtype

### Strategi

**Slett alt og re-importer fra scratch** -- renere enn å prøve å deduplisere.

### Implementasjon

#### 1. Opprett midlertidig importside (`/import`)
- Filupplasting for alle 4 filer (xlsx)
- Parse med `xlsx`-biblioteket (allerede installert)
- Vis fremdrift per steg

#### 2. Oppdater Edge Function (`salesforce-import`)
Ny logikk med **navnebasert matching** istedenfor SF-ID:

**Selskaper** (fil 1): Kolonnene er som før. Slett alle eksisterende selskaper først, re-insert.

**Kontakter** (fil 3): Slett eksisterende, re-insert. Match selskap via `Account Name` → `companies.name`.

**Aktiviteter/Oppgaver** (fil 4 - den nye): Bruker `Task Subtype` og `Event Subtype` for klassifisering:
- `Task Subtype = "Task"` → `tasks`-tabellen (oppfølginger)
- `Task Subtype = "Call"` → `activities`-tabellen med type `call`
- `Event Subtype = "Event"` → `activities`-tabellen med type `meeting`
- Records uten subtype som matcher aktivitetsmønstre → `activities`

Match kontakter via `First Name` + `Last Name` → `contacts`. Match selskap via `Account Name` → `companies.name`.

#### 3. Importrekkefølge
1. Slett activities, tasks, contacts, companies (i den rekkefølgen pga FK)
2. Importer selskaper
3. Importer kontakter (matcher selskap via navn)
4. Importer aktiviteter/oppgaver (matcher kontakt+selskap via navn)

#### 4. Rydde opp etter import
Fjern importside og edge function når alt er verifisert.

### Teknisk detalj

**Fil 4 kolonner** (den nye activities-eksporten):
```
Subject | (tom) | Type | Description | Full Comments | Date | Status | First Name | Last Name | Account Name | Assigned | Task Subtype | Event Subtype | Call Type
Index:  0    1      2       3              4            5       6         7            8           9              10          11              12            13
```

**Klassifiseringslogikk**:
- `Task Subtype = "Call"` → activity type `call`
- `Event Subtype = "Event"` → activity type `meeting`  
- `Task Subtype = "Task"` + `Status != "Ferdig utført"` → `tasks`-tabellen
- `Task Subtype = "Task"` + `Status = "Ferdig utført"` → `tasks`-tabellen med status `completed`

Alle "Call"-poster (også de med subjects som "Linkedin", "Sendt mail") blir `call`-type i activities, da Salesforce kategoriserer dem slik.

