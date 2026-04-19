
## Mål
Gi `/design-lab/eksterne` samme header-layout som `/design-lab/aktive-oppdrag`: tittel + antall til venstre, tekststørrelse + primærknapper helt til høyre, og horisontal strek under — i stedet for dagens inline søk + knapperad inne i embed-innholdet.

## Funn
- `DesignLabPageShell` rendrer allerede tittel, count, `TextSizeControl` og `headerRight` med `border-bottom: 1px solid C.border` (linje 41 i shellen). Aktive oppdrag bruker `headerRight` for "Nytt oppdrag" — det er mønsteret.
- `DesignLabEksterneKonsulenter.tsx` sender ingen `headerRight` i dag, og embedder hele `EksterneKonsulenter` som har sin egen knapperad (Importer CVer, Rydd dubletter, Legg til) + søkefelt på linje 205–239. Dette dupliserer chrome under shell-headeren.
- `EksterneKonsulenter` har Cmd+K (`embeddedSplit`-modus åpner palette), så søkefeltet på linje 207–215 er allerede unødvendig i embed — i tråd med `mem://style/design-lab-search-placement` (skjul søk når Cmd+K finnes).

## Løsning

### 1) `DesignLabEksterneKonsulenter.tsx` — løft knappene til shell-header
Legg til `headerRight` med to handlinger som matcher Aktive oppdrag-mønsteret:
- **Importer CVer** (sekundær — `DesignLabIconButton`-stil eller ghost): navigerer til `/stacq/importer-cver`
- **Legg til** (primær — `DesignLabPrimaryAction` med `<Plus />`): trigger opprettelse i embedded siden via en `createRequestId`-counter, samme mekanikk som `DesignLabKonsulenterOppdrag`

"Rydd dubletter" droppes fra header (sjelden brukt admin-handling) — beholdes inne i listevisningen som en mindre handling, eller flyttes til en overflow-meny senere.

### 2) `EksterneKonsulenter.tsx` — skjul intern knapperad i embed
- Legg til ny prop `showActionBar?: boolean` (default `true`).
- Når `embeddedSplit` er true → skjul hele blokken på linje 205–239 (søkefelt + tre knapper). Filtrene (Type/Status, linje 241–259) beholdes — de hører til listen, ikke header.
- Legg til `createRequestId?: number` prop som via `useEffect` åpner opprettelses-modalen (`setModalOpen(true)` + reset `editId`) når den øker — samme pattern som `KonsulenterOppdrag`.

### 3) Resultat
```
┌──────────────────────────────────────────────────────────┐
│ Eksterne · 42         T S M L XL XXL  [Importer] [+ Legg til] │
├──────────────────────────────────────────────────────────┤  ← strek (allerede i shell)
│ Type:   [Alle] [Freelance] [Via partner]                 │
│ Status: [Alle] [Tilgjengelig] [Ikke ledig]               │
│ ┌─ liste ──────────────┬─ detaljpanel ──────────────┐    │
│ │ ...                  │ Trykk ⌘K for å søke.       │    │
└──────────────────────────────────────────────────────────┘
```

## Filer som endres
- `src/pages/DesignLabEksterneKonsulenter.tsx` — legg til `headerRight` (Importer CVer + Legg til), bruk `createRequestId`-state
- `src/pages/EksterneKonsulenter.tsx` — skjul søk + handlingsrad når `embeddedSplit` er true, godta `createRequestId`-prop som åpner opprettelses-modalen

## Utenfor scope
- Endre V1-versjonen av `/eksterne` (kun embed-pathen påvirkes via `embeddedSplit`)
- Flytte filtrene til shell-header
- Endre "Rydd dubletter"-flyten utover å fjerne den fra hovedheaderen
