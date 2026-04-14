

# Plan: Design Lab V6 — "Attio-elegansen"

## Konsept

Inspirert av Attio: spreadsheet-aktig datadensitet i en ren, hvit, romslig ramme. Kontaktlisten er en ren tabell med inline-redigerbare celler. Detaljsiden er et **side-panel (sheet)** som glir inn fra hoyre, ikke en ny side — slik at du aldri mister konteksten i listen.

Nokkelprinsippene fra Attio:
- Ren hvit bakgrunn, subtile borders (`#E8E8E8`), ingen skygger
- Spreadsheet-logikk: kolonne-headers er sticky, rader er tette (44px) men lesbare
- Inline-redigering pa hover (signal-badge, eier)
- Detaljpanel som sheet fra hoyre (480px bred)
- Svarte primary-knapper, gra sekundaere
- Typografi: system font stack, 13-14px for data, 11px uppercase for headers

## Visuelt system

```text
Bakgrunn:        #FFFFFF
Borders:         #E8E8E8 (1px)
Text primar:     #1A1A1A
Text sekundar:   #717171
Text tertiar:    #A3A3A3
Hover row:       #FAFAFA
Selected row:    #F5F5F5 med 2px venstre blå border
Primary button:  #171717 bg, #FFFFFF text
Rad-hoyde:       44px
Header-hoyde:    36px, 11px uppercase, #717171
Font:            Inter, -apple-system
```

## Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  STACQ          Kontakter   Selskaper   Oppdrag              [Søk ⌘K]  JR  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Kontakter  142           [+ Ny kontakt]          Eier ▾  Signal ▾  Søk    │
│                                                                              │
│  ☐  NAVN              SELSKAP         SIGNAL        EIER           SIST     │
│  ─────────────────────────────────────────────────────────────────────────   │
│  ☐  Erik Solberg      Aker Solutions  ● Behov nå    Jon Richard    1d       │
│     Tech Lead                                       Nygaard                  │
│  ☐  Kari Hansen       DNB             ● Behov nå    Thomas         4d    ◄──┐
│     Engineering Mgr                                 Eriksen             │   │
│  ☐  Magnus Pedersen   Cognite         ● Fremtidig   Jon Richard    9d   │   │
│     VP Engineering                                  Nygaard             │   │
│  ...                                                                    │   │
│                                                                         │   │
│                                                              ┌──────────┘   │
│                                                              │ SHEET PANEL  │
│                                                              │ 480px        │
│                                                              │              │
│                                                              │ Kari Hansen  │
│                                                              │ Eng. Mgr     │
│                                                              │ DNB          │
│                                                              │              │
│                                                              │ ● Behov nå   │
│                                                              │              │
│                                                              │ NESTE STEG   │
│                                                              │ □ Book demo  │
│                                                              │              │
│                                                              │ AKTIVITETER  │
│                                                              │ ...          │
│                                                              │              │
│                                                              │ KONSULENTER  │
│                                                              │ Martin O 91% │
│                                                              └──────────────┘
└──────────────────────────────────────────────────────────────────────────────┘
```

## Hva er genuint nytt (vs alle tidligere forsok)

1. **Sheet-panel i stedet for navigasjon** — klikk pa rad apner detaljer i et 480px side-panel uten a forlate listen
2. **Spreadsheet-estetikk** — 44px rader, checkbox-kolonne, sortbare headers med piler, tight data
3. **Ingen fargede bakgrunner** — kun hvitt og subtile borders. Signal vises som en liten farget prikk + tekst
4. **Toppmeny med navigasjon** — "Kontakter / Selskaper / Oppdrag" som tabs i toppstripen (ikke sidebar)
5. **Inline signal-edit** — klikk pa signal-badge i tabellen for a endre direkte (dropdown)
6. **Bulk-actions** — checkbox pa rader for fremtidig bulk-operasjoner

## Realistiske data

Bruker de 12 kontaktene som allerede finnes i mockdata (Erik Solberg/Aker, Kari Hansen/DNB, etc.) med:
- Fullstendige aktivitetslogger per kontakt
- Oppfolginger med datoer
- Konsulentmatch med tech-tags
- Eier alltid fullt navn

## Filer som endres

1. **`src/pages/DesignLabContacts.tsx`** — fullstendig omskrivning: spreadsheet-tabell + sheet-panel for detaljer
2. **`src/pages/DesignLabContactDetail.tsx`** — fjernes/tommes (detaljvisningen er na inne i sheet-panelet i DesignLabContacts)

## Ikke beort
- Ingen App.tsx-endringer (ruter finnes)
- Ingen endring i eksisterende CRM
- Alt mockdata

