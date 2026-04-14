

# Plan: Design Lab V5 — "Action Queue"

## Hvorfor alt til nå har feilet

Alle tidligere versjoner har vært **datalister med ulik farge**. Det eksisterende CRM-et er også en dataliste. Å endre bakgrunnsfarge fra hvit til mørk til varm — det er ikke redesign, det er theming.

Det genuint nye: **Kontaktlisten er ikke en tabell. Den er en prioritert handlingskø.**

## Konsept: "Hvem ringer jeg nå?"

### Toppfelt — Daglig prioritet (nytt konsept)

Øverst på siden: **3 prioritetskort** side ved side for de kontaktene som trenger oppmerksomhet FØRST. Ikke en tabell-rad — et kort med:
- Stort navn + selskap
- Konkret neste handling ("Send 2 ML-profiler til Erik")
- Hvor lenge siden siste kontakt (fargkodet urgency)
- **Ring**-knapp direkte på kortet

Dette finnes IKKE i dagens CRM. Det er en ny interaksjonsmodell.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  STACQ                    [Søk ⌘K]                              JR    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Ring neste                                                    12 apr   │
│                                                                         │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  │ ▌Erik Solberg       │ │ ▌Henrik Berg        │ │ ▌Silje Strand       │
│  │  Aker Solutions     │ │  Equinor            │ │  Schibsted          │
│  │                     │ │                     │ │                     │
│  │  Send 2 ML-profiler │ │  2 DevOps-profiler  │ │  Spark-konsulent    │
│  │                     │ │                     │ │                     │
│  │  Sist: 1d · Samtale │ │  Sist: 2d · Samtale │ │  Sist: 3d · Samtale │
│  │              [Ring] │ │              [Ring] │ │              [Ring] │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
│                                                                         │
│  Alle kontakter                                            Eier ▾  ▾   │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ▌ Erik Solberg          Send 2 ML-profiler         Jon Richard    1d  │
│    Tech Lead · Aker      Behov nå                   Nygaard            │
│                                                                         │
│  ▌ Kari Hansen           Book demo med teamleder    Thomas         3d  │
│    Eng. Mgr · DNB        Behov nå                   Eriksen            │
│                                                                         │
│    Magnus Pedersen        Følg opp Q3-behov          Jon Richard   9d  │
│    VP Eng. · Cognite      Fremtidig behov            Nygaard            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Hva er GENUINT NYTT her:

1. **Prioritetskort øverst** — de 3 viktigste kontaktene fremhevet som handlingskort, ikke bare rader i en tabell. Med **direkte ring-knapp**.

2. **Venstre signal-stripe på rader** — i stedet for en badge inne i raden, har hver rad en 3px farget venstrekant (grønn = behov nå, blå = fremtidig, etc). Gir umiddelbar visuell scanning uten å lese tekst.

3. **Handlingen er kolonnen, ikke signalet** — den dominante kolonnen i tabellen er "neste steg" (hva du skal gjøre), ikke "signal" (hva statusen er). Signal vises som tekst under handlingen, nedtonet. Handlingen er bold.

4. **Relativ tid som primær tidsvisning** — "1d", "3d", "2u" i stedet for "11. apr 2026". Visuelt lettere å scanne urgency.

5. **Hover-actions** — ved hover vises ring/e-post-ikoner direkte i raden for umiddelbar handling.

6. **Ingen avatar-sirkler** — fjerner det visuelle støyet. Navnet er nok.

### Visuelt system (annerledes enn dagens CRM)

- **Bakgrunn**: `#FFFFFF` ren hvit — men med tydelig visuelt hierarki gjennom spacing, ikke farger
- **Prioritetskort**: Hvite med `border-left: 3px solid signal-farge`, subtil skygge `0 2px 8px rgba(0,0,0,0.06)`
- **Signal-stripe på rader**: 3px bred farget venstrekant — scannes mye raskere enn badges
- **Typografi**: Inter — men med tydelig størrelses-hierarki:
  - Seksjonstittel ("Ring neste"): 20px/700, mørk
  - Kontaktnavn i kort: 17px/600
  - Kontaktnavn i liste: 14px/600
  - Handling (neste steg): 14px/500, `#111827`
  - Signal-tekst: 12px/500, farget
  - Meta (tid, eier): 13px/400, `#9CA3AF`
- **Ingen avrundede hjørner på hovedcontainer** — skarp, profesjonell
- **Hover**: Raden får en svak bakgrunn `#F9FAFB` og ring/mail-ikoner glir inn fra høyre

### Kontaktdetalj — også nytt

Detaljsiden redesignes med samme filosofi:
- **Handlingsbar øverst**: "Ring", "E-post", "Logg samtale" som primære knapper
- **Stor, tydelig "Neste steg"** som det første du ser under kontaktinfo
- **Tidslinje** med aktiviteter gruppert per måned
- **Konsulentmatch-panel** til høyre: hvilke STACQ-konsulenter matcher dette behovet

## Implementering

### Filer
1. **`src/pages/DesignLabContacts.tsx`** — fullstendig omskrivning med prioritetskort + action-queue-tabell
2. **`src/pages/DesignLabContactDetail.tsx`** — omskrivning med handlings-først layout

### Ikke berørt
- Ingen endring i App.tsx (ruter finnes)
- Ingen endring i eksisterende CRM
- Alt mockdata

