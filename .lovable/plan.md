

## Ny `/design-lab/home` — én kolonne, reell verdi, ingen gjetting

Hjemmesiden bygges helt på nytt. Én vertikal kolonne, maks 720px, sentrert. Ingen "Fokus i dag" (vill gjetting), ingen "Vunnet denne måneden". Kun seksjoner med reell, verifiserbar verdi basert på data vi faktisk har eller kan hente.

### Designkonsept: "Morgenbriefen"

En kortfattet, redaksjonell oppsummering brukeren leser på 30 sekunder. Hver seksjon svarer på ett spørsmål med konkret informasjonsverdi. Én kolonne, luftig, typografidrevet.

### Layout — én kolonne, maks 720px

```text
┌─────────────────────────────────────────────────────────────┐
│  HERO                                                       │
│  God morgen, Jon Richard.        ← 26px / 600               │
│  tirsdag 21. apr. 2026 · uke 17  ← 12px / faint             │
└─────────────────────────────────────────────────────────────┘
   (56px luft)

┌─────────────────────────────────────────────────────────────┐
│  UKEN SÅ LANGT                                              │
│  Kort prosatekst, 2–3 setninger.                            │
│  "Forespørslene har økt 18% mot forrige uke.                │
│   Tre nye selskaper meldte interesse.                       │
│   Equinor har vært stille i 14 dager."                      │
└─────────────────────────────────────────────────────────────┘
   (40px luft, hårfin divider)

┌─────────────────────────────────────────────────────────────┐
│  UOPPDAGET I INNBOKSEN                                      │
│  Skannet 142 e-poster · siste 14 dager                      │
│                                                             │
│  Tre rader, én linje hver:                                  │
│   • Marius Solheim · Kongsberg Defence                      │
│     "...vurderer å hente inn ekstern kapasitet..."          │
│     5d siden · ubesvart                                     │
│                                                             │
│   • Anne Lien · Aker BP                                     │
│     "...trenger noen med IEC 61508-erfaring..."             │
│     2d siden · ulest                                         │
│                                                             │
│   • Lars Mo · Defensico                                     │
│     "...kan vi ta en prat neste uke?"                         │
│     8d siden · ble liggende                                   │
│                                                             │
│  Liten accent-prikk på linjer som krever handling.            │
└─────────────────────────────────────────────────────────────┘
   (40px luft, hårfin divider)

┌─────────────────────────────────────────────────────────────┐
│  MARKEDET DENNE UKEN                                        │
│  Basert på 47 nye Finn-utlysninger                          │
│                                                             │
│  Trender (3 linjer):                                          │
│   +18%   C++-utlysninger                    ↗ 12 totalt     │
│   +3     nye selskaper med embedded-behov                     │
│   −22%   FPGA-aktivitet                     ↘ stille uke      │
│                                                             │
│  Nye selskaper på radaren:                                  │
│   Defensico · Nordic Semiconductor · Kongsberg Geo          │
└─────────────────────────────────────────────────────────────┘
   (40px luft, hårfin divider)

┌─────────────────────────────────────────────────────────────┐
│  KONSULENTER SOM TRENGER PLASSERING                           │
│  4 personer tilgjengelig                                      │
│                                                             │
│  Ola Nordmann                                               │
│  C++ · Embedded Linux · Yocto                 fra 1. mai      │
│                                                             │
│  Kari Hansen                                                │
│  Rust · BLE · sanntid                         fra 15. mai     │
│                                                             │
│  Erik Solheim                                               │
│  FPGA · Verilog · VHDL                        fra 20. mai     │
│                                                             │
│  + 1 til                                                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Ola og Kari matcher Defensico-behovet fra innboksen.       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
   (80px bunnluft)
```

### Designprinsipper

- **Én kolonne, maks 720px.** Ingen sideoppdeling. Lesbart som en avis.
- **Hårfine `borderLight`-dividere** mellom seksjoner, 40px vertikal luft.
- **Typografi:** 26/600 hero, 12/600 seksjonstittel (normal case), 14/400 brødtekst, 12/400 muted meta.
- **Accent (`C.accent`) brukes kun som 6px prikk** på linjer som krever handling — aldri som flate eller knapp.
- **Tall får visuell vekt** i Markedet-seksjonen (16/500), men aldri hero-størrelse.
- **Ingen kort, ingen skygger, ingen badges, ingen ikoner** annet enn evt. en diskret `↗ ↘` glyf for trendretning.
- **Tomme felt utelates** — ingen "Ingen data"-meldinger.

### Innholdsbeslutninger (mockdata)

- Hilsen henter fornavn fra hardkodet `"Jon Richard"` — ingen profilkall.
- Uken så langt: én hardkodet streng (2–3 setninger).
- Innboks: 3 hardkodet rader med avsender, selskap, snippet, alder, status.
- Markedet: 3 trendlinjer + 3 nye selskapsnavn.
- Konsulenter: 4–5 hardkodet rader (navn, tags, tilgjengelig-fra) + én matchhint-linje.

### Teknisk

- **Fil:** `src/pages/DesignLabHome.tsx` — skrives på nytt, beholder `<DesignLabPageShell activePath="/design-lab/home" title="Hjem">` med `maxWidth={720}`.
- Alle gamle imports (`useQuery`, `supabase`, `homeQueueModel`, søk, agent-kall) fjernes.
- Ingen nye komponenter i `system/` — lokale `function`-helpers (Hero, WeekSummary, InboxFinds, MarketSection, BenchSection) i samme fil.
- Kun `C.*`-tokens fra `src/theme.ts`. Inter, vekter 400/500/600.
- Ingen Supabase-kall, ingen edge functions — rendres umiddelbart fra mock.

### Hva som IKKE er med

- Ingen "Fokus i dag" / prioriterte handlinger (vill gjetting).
- Ingen "Vunnet denne måneden" / pengetall.
- Ingen to-kolonners oppsett.
- Ingen pulse-rad med 4 store tall.
- Ingen "Spør agenten", ingen "Topp 10".
- Ingen sitatlinje.

### Verifisering etter implementering

1. Åpne `/design-lab/home` — én smal sentrert kolonne, fire stablede seksjoner under hilsen.
2. Sjekk at brødteksten i "Uken så langt" leses naturlig som prosa.
3. Bekreft at "Uoppdaget i innboksen", "Markedet" og "Konsulenter som trenger plassering" hver svarer på ett konkret nyttighetsspørsmål.
4. Sammenlign med `/design-lab/kontakter`: samme tokens og typografifamilie, men hjemmesiden er roligere og smalere.
5. Resize til 1280px og 5000px — kolonnen sentreres og holder 720px.

