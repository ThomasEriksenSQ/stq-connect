

# Plan: Design Lab V4 — Fullstendig redesign fra scratch

## Problemanalyse

Tre feil med nåværende implementering:
1. **DesignLabContacts.tsx bruker fortsatt det mørke "Obsidian"-temaet** (V2) med `#0A0A0F` bakgrunn, Geist Sans, og signal-grupperte lanes. Den ble aldri oppdatert til V3.
2. **Sidene rendres inni AppLayout** (den gamle CRM-headeren) fordi rutene ligger under `<Route path="/" element={<ProtectedRoutes />}>`. Dette gir den gamle toppmenyen over Design Lab-innholdet.
3. **Detaljsiden (V3)** har riktig lyst tema, men mangler realistiske data og har en for enkel toppmeny.

## Løsning

### 1. Flytt Design Lab-ruter ut av AppLayout

I `App.tsx`: Flytt `/design-lab/*`-rutene ut av `<ProtectedRoutes />`-noden slik at de IKKE rendres inni `AppLayout`. De får sin egen minimale toppstripe i stedet.

### 2. Ny minimal toppstripe (felles for begge sider)

En tynn, ren stripe (48px) med:
- **STACQ** logo til venstre (ren tekst, font-weight 800)
- Søkefelt i midten (bred, ren, med ⌘K hint)
- Brukerinitialer til høyre

Hvit bakgrunn, subtil border-bottom. Ingen navigasjonslenker, ingen dropdown, ingen tema-toggle. Kun det nødvendige.

### 3. Kontaktlisten — ren tabell/worklist

Helt nytt lyst design. Flat, sorterbar tabell med tydelige kolonner:

| KONTAKT | SELSKAP | SIGNAL | EIER | SISTE | NESTE STEG |
|---------|---------|--------|------|-------|------------|

- Hvit bakgrunn, `#FAFAFA` under header
- Romslige rader (64px), tydelig hover
- Store, lesbare signal-badges med fylt farge
- Eier alltid fullt navn
- Søkefelt + filtre (Eier, Signal, CV) som pills over tabellen
- Klikk på rad → navigerer til detaljside

### 4. Realistiske mockdata

12 kontakter med:
- Ekte norske selskaper (Aker Solutions, DNB, Equinor, Schibsted, Telenor, Vipps, Cognite, Storebrand, Kahoot!, Posten, Statkraft, Color Line)
- Realistiske roller (Tech Lead, VP Engineering, CTO, Engineering Manager, etc.)
- Salgsrelevant historikk: siste aktivitet med type og dato, neste oppfølging
- Konsulentmatch-kontekst: tech-tags, CV-status, matchende konsulenter
- Flere CRM-felter: lokasjon, selskapstype (Kunde/Potensiell), antall aktive oppdrag

### 5. Kontaktdetaljside — oppdatert

Beholder V3-strukturen (hero card, to-kolonne, aktivitetstidslinje) men:
- Bruker den nye toppstripen i stedet for den enkle "← Tilbake"-headeren
- Legger til tilbake-knapp under toppstripen
- Mer realistiske data per kontakt (flere aktiviteter, oppfølginger, notater)
- Konsulentmatch-seksjon: viser hvilke STACQ-konsulenter som matcher kontaktens behov

### 6. Visuelt system

- **Bakgrunn**: `#FAFAFA` (lys, nøytral)
- **Overflater**: `#FFFFFF` med `border: 1px solid #E5E7EB`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`
- **Tekst primær**: `#111827` (ikke ren svart, men nær)
- **Tekst sekundær**: `#6B7280`
- **Tekst tertiær**: `#9CA3AF`
- **Aksent**: `#2563EB` (profesjonell blå for primærhandlinger)
- **Font**: Inter, system-ui fallback
- **Typografi**: 28px/700 sidetittel, 15px/600 kontaktnavn i liste, 14px/400 brødtekst, 12px/500 uppercase seksjons-labels
- **Signal-badges**: Fylt bakgrunn, border, rundet pill — emerald/blue/amber/gray/red

## Filer som endres

1. **`src/App.tsx`** — Flytt design-lab-ruter ut av ProtectedRoutes til en egen wrappet rute med autentisering men uten AppLayout
2. **`src/pages/DesignLabContacts.tsx`** — Fullstendig omskrivning med lyst tema, flat tabell, ny toppstripe, realistiske data
3. **`src/pages/DesignLabContactDetail.tsx`** — Oppdatert med ny toppstripe, mer realistiske data, konsulentmatch-seksjon

## Ikke berørt
- Ingen endringer i eksisterende CRM-kode
- Alt mockdata, ingen database
- Kun design-lab-sider

