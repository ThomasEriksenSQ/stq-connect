

## Plan: Total redesign av Kontakter-siden

### Designteam-diskusjon

**Teammedlemmer:**
- **Lead Product Designer** — ansvarlig for layout, informasjonsarkitektur og visuelt hierarki
- **UX Researcher** — representerer brukerbehov (2 power users: Jon Richard og Thomas)
- **Frontend Architect** — ansvarlig for teknisk gjennomførbarhet og ytelse
- **Interaction Designer** — mikro-interaksjoner, hover states, overganger

---

### Problemanalyse

Kontakter-siden er i dag en 2240-linjers monolittfil som gjør alt:
- Konsulent-velger (jaktmodus)
- Tre forskjellige filter-rader (Eier, Signal, Type, Match-chips)
- To helt separate tabellvisninger (kontaktliste vs. match-leads)
- Mobilkort + desktop-grid duplisert to ganger
- Inline signal-endring, CV-toggle, Innkjøper-toggle

**Hovedproblemene:**
1. Visuell overbelastning — for mange filter-rader tar opp skjermhøyden
2. Kontaktlisten og jaktmodus er to ulike verktøy tvunget inn i én side
3. Ingen visuell differensiering mellom "hverdagsbruk" (søk kontakt) og "salgsarbeid" (jakt)
4. Tabellen mangler personlighet — ren data uten visuelle holdepunkter

---

### Designretning: "Focused Workspace"

Inspirert av Linear, Attio og Notion — en CRM som føles som et profesjonelt arbeidsverktøy.

**Nøkkelprinsipper:**
1. **Progressive disclosure** — vis kun det brukeren trenger akkurat nå
2. **Mode-switching** — tydelig skifte mellom "Kontaktliste" og "Jakt" med tabs
3. **Density control** — kompakt som standard, men med luft der det teller
4. **Inline actions** — alt skjer i flyten, ingen modaler unntatt destruktive handlinger

---

### Konkrete endringer

**1. Header + Modus-tabs**

Erstatt den vertikale konsulent-velgeren med en horisontal tab-bar:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Kontakter                                            369 totalt │
│                                                                 │
│ [Kontaktliste]  [Jakt: Per Erik ▾]  [Jakt: Thomas ▾]          │
│                                                                 │
│ 🔍 Søk...          Eier ▾   Signal ▾   Type ▾                 │
├─────────────────────────────────────────────────────────────────┤
│ TABELL                                                          │
└─────────────────────────────────────────────────────────────────┘
```

- Konsulenter vises som tabs med dropdown for flere
- Filtere samles i en kompakt rad med dropdown-menus i stedet for chips
- Frigjør 80-100px vertikal plass

**2. Tabelldesign — "Stacked row"**

I stedet for en flat grid med 7 kolonner, bruk en to-linjers rad:

```text
┌──────────────────────────────────────────────────────────────────┐
│ ● Kari Nordmann          Equinor ASA         Behov nå    2d     │
│   Engineering Manager    📡 Finn  CV  Innkjøper                 │
├──────────────────────────────────────────────────────────────────┤
│ ● Ole Hansen             Aker Solutions       Fremtidig   1u     │
│   VP Technology          CV                                      │
└──────────────────────────────────────────────────────────────────┘
```

- Linje 1: Navn (bold), Selskap, Signal-badge, Siste aktivitet
- Linje 2: Stilling (muted), ikoner/tags (Finn-radar, CV, Innkjøper)
- Venstre temperaturbar beholdes (hett/lovende/mulig/sovende)
- Mer lesbart, færre kolonner å skanne

**3. Filtre som dropdown-menyer**

Dagens 3 rader med chips erstattes med en kompakt filterbar:

```text
🔍 Søk...   [Eier: Alle ▾]   [Signal: Alle ▾]   [Type: Alle ▾]   ⟳ Nullstill
```

- Hvert filter er en liten dropdown som viser aktive valg som en teller
- Aktive filtre viser en subtil badge: `Eier: Jon Richard ✕`
- Sparer 60px+ vertikal plass

**4. Jaktmodus redesign**

Når en konsulent velges, bytter tabellen til jakt-layout:

```text
┌──────────────────────────────────────────────────────────────────┐
│ ● Equinor · Kari Nordmann    Forespørsel · Finn    8/10   Hett  │
│   Engineering Manager        React, Node, AWS      Høy evidens  │
├──────────────────────────────────────────────────────────────────┤
```

- Match-score vises som en farget pille (gron/gul/rod)
- Kilde-chips (Forespørsel, Finn, etc.) som subtile tags
- Fjern duplisert mobilkort — bruk samme stacked-row med responsive tilpasning

**5. Komponentoppdeling**

Splitt den monolittiske filen i mindre komponenter:

```text
src/pages/Contacts.tsx              (orkestrator, ~200 linjer)
src/components/contacts/
  ContactsHeader.tsx                (tittel + tabs)
  ContactFilterBar.tsx              (søk + filter-dropdowns)
  ConsultantPicker.tsx              (konsulent-tabs for jaktmodus)
  ContactTable.tsx                  (standard kontaktliste)
  ContactTableRow.tsx               (enkeltrad)
  HuntTable.tsx                     (jakt-tabell)
  HuntTableRow.tsx                  (jakt-rad)
  useContactsData.ts                (data-fetching hook)
  useContactFilters.ts              (filter-logikk hook)
  useContactSort.ts                 (sortering hook)
```

**6. Visuell polish**

- Avatar-initialer med farget bakgrunn (basert på navn-hash) i stedet for bare tekst
- Hover-rad: subtil skygge-lift i stedet for bare bakgrunnsfarge
- Signal-badge: bruk dot-indikator + tekst (som i Linear)
- Temperaturbar: gradient i stedet for flat farge
- Skeleton loading: bruk pulserende rader som matcher den faktiske rad-høyden
- Smooth scroll til topp ved filtrering

**7. Tastatur-navigasjon**

- `j/k` for opp/ned i listen
- `Enter` for å åpne kontakt
- `/` for å fokusere søk
- `Esc` for å lukke filtre

---

### Implementeringsrekkefølge

1. **Ekstraher hooks** (`useContactsData`, `useContactFilters`, `useContactSort`) — ingen visuell endring
2. **Splitt komponenter** — flytt render-logikk ut av Contacts.tsx
3. **Ny filterbar** med dropdowns
4. **Ny tabellrad** (stacked two-line)
5. **Konsulent-tabs** erstatter vertikal velger
6. **Jaktmodus-tabell** med ny layout
7. **Visuell polish** (avatarer, hover, animasjoner)
8. **Tastatur-navigasjon**

### Risiko og avveininger
- Alle eksisterende funksjoner (toggle CV, toggle Innkjøper, signal-endring, Mailchimp-synk) beholdes uendret
- Ingen database- eller API-endringer
- Mobilvisningen forenkles ved at stacked-row skalerer naturlig ned

