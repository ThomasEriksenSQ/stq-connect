

# Plan: Design Lab V3 — Total omstart

## Problemet med V2
Det mørke "Obsidian"-temaet er knapt lesbart: 11-13px tekst i grått på nesten-svart, signal-grupperte seksjoner som fragmenterer listen, og for mye visuell pynt uten funksjon. Det føles som et konseptdesign, ikke et arbeidsverktøy.

## Ny retning: "Warm Workspace"

Inspirert av Notion's romslighet, Attio's datarikdom, og Folk's varme. Ikke mørkt, ikke sterilt hvitt — men et varmt, romslig arbeidsverktøy med tydelig hierarki.

### Kjerneprinsipp
**Les alt uten å anstrenge deg. Finn hvem du trenger innen 2 sekunder. Handle umiddelbart.**

### Visuell identitet

- **Bakgrunn**: Varm off-white `#F8F7F4` (papir-aktig, ikke klinisk)
- **Overflater**: Ren hvit `#FFFFFF` med subtil skygge
- **Tekst**: Nesten svart `#1A1A1A` primær, `#6B6B6B` sekundær
- **Aksent**: Dyp blå-sort `#1A1A2E` for primærknapper
- **Signaler**: Store, lesbare fargeblokker — ikke prikker

### Typografi
- Font: **Inter** (trygt, lesbart, profesjonelt)
- Navn i liste: **15px/600** — synlig uten å lete
- Brødtekst: **14px/400** — komfortabel lesing
- Labels: **12px/500 uppercase** — tydelig hierarki
- Ingen tekst under 12px

### Kontaktlisten — flat tabell, men gjort riktig

Ikke grupperte lanes. En flat, sorterbar liste som viser alt du trenger:

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Kontakter                                                       │
│  12 kontakter                                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Søk etter navn, selskap eller teknologi...               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Eier ▾    Signal ▾    CV ▾                    Nullstill filtre  │
│                                                                  │
│  NAVN                    SIGNAL          EIER              SIST  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Erik Solberg            ██ Behov nå     Jon Richard       1d   │
│  Tech Lead · Aker        Python ML GCP   Nygaard                │
│                                                                  │
│  Kari Hansen        CV   ██ Behov nå     Thomas            3d   │
│  Eng. Manager · DNB      Java Kotlin     Eriksen                │
│                                                                  │
│  Silje Strand            ██ Behov nå     Jon Richard       2d   │
│  Data Eng. · Schibsted   Spark Kafka     Nygaard                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Hver rad er **72px høy** — romslig, lett å treffe, lett å lese. Hover viser en tynn linje under raden, ikke fargeskifte. Klikk → navigerer til detaljside.

### Signal-badges — store og tydelige
Ikke prikker. Ikke tekst-bare. En tydelig badge med fylt bakgrunn:
- Behov nå: grønn bakgrunn, hvit tekst
- Fremtidig: blå bakgrunn, hvit tekst  
- Kanskje: amber bakgrunn, mørk tekst
- Ukjent: grå bakgrunn, mørk tekst
- Aldri: rød bakgrunn, hvit tekst

### Kontaktdetalj — fullbredde, oversiktlig

```text
┌──────────────────────────────────────────────────────────────────┐
│  ← Tilbake                                                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  ES   Erik Solberg                                        │  │
│  │       Tech Lead · Aker Solutions                          │  │
│  │                                                            │  │
│  │  ██ Behov nå    CV    Jon Richard Nygaard                 │  │
│  │                                                            │  │
│  │  [Logg samtale]  [Ny oppfølging]                          │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ KONTAKTINFO ──────┐  ┌─ NESTE STEG ──────────────────────┐ │
│  │                     │  │                                    │ │
│  │  erik@aker.no    📋 │  │  □ Finn ML-kandidat    16. apr    │ │
│  │  +47 900 11 222  📋 │  │  □ Send CV til Erik    18. apr    │ │
│  │  LinkedIn ↗         │  │  □ Book demomøte       22. apr    │ │
│  │                     │  │                                    │ │
│  │  Python · ML · GCP  │  │                                    │ │
│  │  TensorFlow · Docker│  │                                    │ │
│  └─────────────────────┘  └────────────────────────────────────┘ │
│                                                                  │
│  ─── AKTIVITETER ──────────────────────────────────────────────  │
│                                                                  │
│  April 2026                                                      │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  📞  Hastebehov ML                              13. apr 2026    │
│      Prosjektet er 3 uker forsinket. Trenger senior             │
│      ML-ingeniør med GCP-erfaring...                            │
│                                                                  │
│  📋  Kvartalsgjennomgang                         1. apr 2026    │
│      Gikk gjennom pipeline og leveranser...                     │
│                                                                  │
│  ─── NOTATER ──────────────────────────────────────────────────  │
│                                                                  │
│  Haster — trenger ML-ingeniør innen 2 uker. Erik er             │
│  besluttningstaker og foretrekker senior-profiler med            │
│  erfaring fra energisektoren.                                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Hva som er NYTT (ikke bare "pent")

1. **72px rader** — dobbelt så høye som V2, massivt bedre lesbarhet
2. **Varm bakgrunn** — ikke hvit, ikke mørk, men papir-aktig `#F8F7F4`
3. **Fylt signal-badges** — umiddelbart gjenkjennelige, ikke prikker
4. **Detaljside med hero-kort** — kontaktinfo i et visuelt framtredende kort øverst
5. **"Neste steg"-seksjon** — oppfølginger er viktigst, plassert ved siden av kontaktinfo
6. **Monokrom aksent** — dyp mørk blå-sort for knapper, ikke lilla/indigo
7. **Ingen gruppering** — flat liste med sortering, som et ekte arbeidsverktøy

## Implementering

### Filer som skrives
1. **`src/pages/DesignLabContacts.tsx`** — fullstendig omskrivning
2. **`src/pages/DesignLabContactDetail.tsx`** — fullstendig omskrivning

### Ikke berørt
- `src/App.tsx` — ruter finnes allerede
- Eksisterende CRM-kode — uendret
- Ingen database — alt mockdata

