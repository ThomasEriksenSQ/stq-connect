

# Plan: Neste-generasjons CRM Design Lab — Kontakter

## Ekspertteamets analyse

**Visuell designer (Lea)**: Den eksisterende Design Lab-siden er en god start, men den lener seg for mye på grå nøytralfarger og mangler den "premium SaaS"-følelsen. Vi trenger mer kontrast, bedre bruk av negative space, og en distinkt visuell identitet — ikke bare "ren". Tenk Vercel's mørke/lyse kontraster, Linear's presisjon, Attio's datarikdom uten kaos.

**Typografi-spesialist (Marcus)**: Inter er riktig valg, men vi bruker det feil. For mange størrelser (10px, 11px, 12px, 13px, 14px) uten system. Vi trenger en strict type scale: 11/12/13/15/20/28px med klare roller. Vektene bør begrenses til 400/500/600/700.

**Interaksjonsdesigner (Sara)**: Detaljpanelet fungerer, men det er for passivt. Det bør føles som en "arbeidsflate", ikke bare en visning. Kontaktdetalj-siden (når man klikker seg inn) mangler helt — vi trenger den som en fullskjerm premium-opplevelse med tydelige handlingssoner.

**Lesbarhetsspesialist (Henrik)**: Grå tekst på lys bakgrunn (#9CA3AF på #FAFAFA) gir for lav kontrast. Sekundærtekst bør være minimum #6B7280. Radene i listen trenger mer vertikal padding for touch-vennlighet og visuell ro.

**Intuitivitetsekspert (Nora)**: Hover-actions som erstatter tidsstempel er problematisk — brukeren mister kontekst. Vis begge deler. Sortering bør ha visuell indikator for aktiv retning. Filterpillene trenger en "Nullstill alle"-knapp.

## Teamets enstemmige designbeslutninger

### 1. To nye sider, fullstendig redesign

**Erstatt** eksisterende `DesignLabContacts.tsx` med nytt design. Legg til ny side for kontaktdetalj.

- `/design-lab/kontakter` — Kontaktlisten (redesignet fra bunnen)
- `/design-lab/kontakter/:id` — Kontaktdetalj (helt ny)

### 2. Visuelt konsept: "Precision Workspace"

Inspirert av Linear's ro, Vercel's kontraster, og Attio's datarikdom.

```text
┌──────────────────────────────────────────────────────────────────┐
│  STACQ · Design Lab                                    ◯ ◯ ◯   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Kontakter                                    12 kontakter       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 🔍  Søk kontakter, selskaper, teknologier…        ⌘K    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Eier ▾]  [Signal ▾]  [CV ▾]               Nullstill           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ KONTAKT              SIGNAL        EIER         SIST    │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ ◯ Erik Solberg       ● Behov nå    JRN          1d      │    │
│  │   Tech Lead · Aker Solutions                     📞 ✉ ⏰ │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ ◯ Ola Nordmann    CV ● Behov nå    JRN          3d      │    │
│  │   CTO · Equinor ASA                                     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│                  ┌─────────────────────────┐                     │
│                  │  DETALJPANEL (40%)       │                     │
│                  │  Navn, signal, kontakt   │                     │
│                  │  Oppfølginger            │                     │
│                  │  Aktiviteter             │                     │
│                  │  [Logg samtale] [Ny opp] │                     │
│                  └─────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

### 3. Kontaktdetalj-side (ny)

Når brukeren klikker kontaktens navn (ikke bare raden), åpnes en fullskjerm detaljside:

```text
┌──────────────────────────────────────────────────────────────────┐
│  ← Tilbake til kontakter                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ◯  Erik Solberg                          [Logg samtale]        │
│     Tech Lead · Aker Solutions             [Ny oppfølging]      │
│     ● Behov nå    CV    Eier: Jon Richard Nygaard               │
│                                                                  │
│  ┌─────────────────────────┬────────────────────────────┐       │
│  │  KONTAKTINFO            │  SNAPSHOT                  │       │
│  │  erik@aker... ✉ 📋      │  Siste: 1d · Samtale       │       │
│  │  +47 900... 📞           │  Neste: 16. apr · Finn ML  │       │
│  │  Python · ML · GCP      │                            │       │
│  ├─────────────────────────┴────────────────────────────┤       │
│  │                                                      │       │
│  │  OPPFØLGINGER                                        │       │
│  │  □ Finn ML-kandidat               16. apr 2026       │       │
│  │                                                      │       │
│  │  AKTIVITETER                                         │       │
│  │  ── April 2026 ──────────────────────────────        │       │
│  │  📞 Hastebehov ML                 13. apr 2026       │       │
│  │     Prosjektet er forsinket...                       │       │
│  │                                                      │       │
│  │  NOTATER                                             │       │
│  │  Haster — trenger ML-ingeniør innen 2 uker.         │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### 4. Designsystem-endringer fra V1

| Element | V1 (nåværende) | V2 (ny) |
|---------|---------------|---------|
| Bakgrunn | #FAFAFA gjennomgående | Hvit header, #FAFBFC liste |
| Rader | 52px, hover → 64px (ustabilt) | Fast 56px, ingen ekspansjon |
| Hover-actions | Erstatter tidsstempel | Vises i tillegg, til høyre |
| Eier-kolonne | Mangler i listen | Ny kolonne med initialer-pill |
| CV-badge | Bare i rad, liten | Tydeligere, med ✗ for avmeldt |
| Sortering | Ingen visuell indikator | Pil opp/ned på aktiv kolonne |
| Radklikk | Toggle panel | Klikk rad → panel, klikk navn → detaljside |
| Filtre | Ingen nullstill-knapp | "Nullstill"-lenke når filtre er aktive |
| Tekst-kontrast | #9CA3AF sekundær | #6B7280 sekundær (bedre kontrast) |
| Type scale | 7 størrelser | 6 størrelser med klare roller |
| Kontaktdetalj | Kun i sidepanel | Egen fullskjerm-side |
| Header | Flat | Subtil shadow ved scroll |

### 5. Fargepalett V2

- **Primær aksent**: `#4F46E5` (dypere indigo, mer autoritet enn #6366F1)
- **Primær tekst**: `#111827`
- **Sekundær tekst**: `#6B7280` (oppgradert fra #9CA3AF)
- **Tertiær tekst**: `#9CA3AF` (kun for timestamps)
- **Overflate**: `#FFFFFF` (kort, header, panel)
- **Bakgrunn**: `#FAFBFC` (listebakgrunn)
- **Border**: `#E5E7EB` (primær), `#F3F4F6` (subtil)
- **Signal-dots**: Emerald-500, Blue-500, Amber-500, Gray-400, Red-500

### 6. Typografi-scale

| Rolle | Størrelse | Vekt | Farge |
|-------|----------|------|-------|
| Sidetittel | 28px | 700 | #111827 |
| Kontaktnavn (detalj) | 20px | 700 | #111827 |
| Kontaktnavn (rad) | 14px | 600 | #111827 |
| Seksjonstittel | 11px | 700 | #6B7280, uppercase, tracking 0.08em |
| Brødtekst | 13px | 400 | #374151 |
| Meta/tid | 12px | 500 | #9CA3AF |

## Implementering

### Filer som endres/opprettes

1. **`src/pages/DesignLabContacts.tsx`** — Fullstendig omskrivning med nytt design, 4-kolonne grid (kontakt, signal, eier, sist), fast radhøyde, hover-actions uten layout-shift, scrollbar-aware header shadow
2. **`src/pages/DesignLabContactDetail.tsx`** — Ny side for fullskjerm kontaktdetalj med snapshot-rad, oppfølginger, aktivitetstidslinje, notater
3. **`src/App.tsx`** — Legg til rute for `/design-lab/kontakter/:id`

### Ikke berørt
- Ingen endringer i eksisterende CRM-kode
- Ingen database-tilkobling
- Alt er mockdata

