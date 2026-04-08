

## Plan: Flytt redigeringsknappen til ansattens profilside

### Oversikt
Fjern blyant-ikonet (rediger) fra ansattlisten og legg det til i headeren på den individuelle ansattsiden, ved siden av "Finn oppdrag" og "CV-editor".

### Endringer

**1. `src/pages/KonsulenterAnsatte.tsx`**
- Fjern blyant-knappen fra ACTIONS-kolonnen (linje 343-348)
- Fjern `openEditMode`-state og relatert logikk siden den kun brukes av redigeringsknappen
- Oppdater `GRID_COLS` for å fjerne ekstra plass (reduser siste kolonne fra 64px til ~40px)
- Behold kun profil-knappen (User-ikonet) i tabellen

**2. `src/pages/AnsattDetail.tsx`**
- Legg til en "Rediger"-knapp med Pencil-ikon i header-området (ml-auto flex-gruppen), ved siden av "Finn oppdrag"
- Knappen åpner `AnsattDetailSheet` i edit-modus (`openInEditMode={true}`)
- Legg til nødvendig state for å styre dette

### Filer som endres
- `src/pages/KonsulenterAnsatte.tsx`
- `src/pages/AnsattDetail.tsx`

