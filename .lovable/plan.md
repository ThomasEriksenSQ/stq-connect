

## Hjem v3.1 — utvider Morgenkø med fire nye datakilder

Bygger videre på den godkjente v3-planen. Tar inn fire nye krav som *anrikning* av eksisterende seksjoner — ikke nye widgets.

### Nye krav og hvor de havner

| Krav | Hvor i layoutet | Hvordan |
|---|---|---|
| Skann brukerens Outlook-innboks (også eldre) | Nytt øverste panel **"Innboks-puls (AI)"** | Ny edge function `inbox-pulse` skanner siste 14d innboks (alle e-poster, ikke filtrert på kontakt). AI lager én oppsummering med 3–5 oppdagelser merket "ny", "lå begravd" eller "tråd-oppfølging" |
| AI matcher tilgjengelige konsulenter mot beste leads | Ny seksjon **"Tilgjengelige konsulenter → beste lead"** rett under innboks | Klient henter `stacq_ansatte` med `tilgjengelig_fra`, AI matcher mot topp-leads med teknologi-match + signal |
| Nye forespørsler siste uka | Ny rad **"Nye forespørsler (7d)"** | Direkte query mot `foresporsler` der `mottatt_dato >= now()-7d`, kompakt liste |
| Topp 10 hotteste leads | Erstatter **"Resten av køen"** fra v3 | `getHeatResult` over alle eide kontakter, sortert etter `score`, vis topp 10 (ikke topp 3 fokus + 11 — bare én klar liste på 10) |

### Revidert anatomi

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Hjem · Morgenkø                                              ⌘K  │
├──────────────────────────────────────────────────────────────────────┤
│ Pipeline                                                              │
│   4 forespørsler (45d)  ·  3 konsulenter ledige (30d)                │
│   2 fornyelser (7d)     ·  1 vunnet i går                            │
├──────────────────────────────────────────────────────────────────────┤
│ Innboks-puls — AI har lest 47 e-poster siste 14 dager        ↻      │
│  • Equinor svarte på CV-pitch (3d gammel) — du har ikke svart       │
│    [→ åpne tråd]                                                     │
│  • DNV-Henrik nevnte "Q3-budsjett" i e-post 9d siden (begravd)      │
│    [→ åpne tråd]                                                     │
│  • TietoEvry takket for møtet — ingen oppfølging logget             │
│    [→ åpne tråd]                                                     │
├──────────────────────────────────────────────────────────────────────┤
│ Tilgjengelige konsulenter — AI foreslår beste lead nå                │
│  Lars Hansen   ledig 15. mai   C++/Yocto                             │
│    → Kongsberg Maritime (Håkon Gjøne) · 92% match · Behov nå        │
│    [→ kontakt]  [Vis CV]  [Skriv pitch]                             │
│  Mona Berg     ledig 1. juni   Embedded Linux/Rust                   │
│    → Equinor (Kjell Ingebo) · 87% match · Får fremtidig             │
│    [→ kontakt]  [Vis CV]  [Skriv pitch]                             │
│  Tor Olsen     ledig 12. juni  FPGA/VHDL                             │
│    → DNV (Henrik Sand) · 78% match · Mulig                          │
│    [→ kontakt]  [Vis CV]  [Skriv pitch]                             │
├──────────────────────────────────────────────────────────────────────┤
│ Nye forespørsler (7d) · 5                                            │
│  i går   Aker Solutions    Embedded Linux, Yocto      Trondheim  →   │
│  2d      DNV               C++, Qt                    Høvik      →   │
│  3d      Kongsberg Mar.    FPGA, VHDL                 Kongsberg  →   │
│  5d      Equinor           Python, sikkerhet          Stavanger  →   │
│  6d      TietoEvry         C, MCU                     Oslo       →   │
├──────────────────────────────────────────────────────────────────────┤
│ Topp 10 hotteste leads                                                │
│  ●● Hett   Håkon Gjøne     Kongsberg Maritime   2 forespørsler  →   │
│  ●● Hett   Kjell Ingebo    Equinor              CC i går        →   │
│  ●  Lov    Henrik Sand     DNV                  21d uten kontakt →   │
│  ●  Lov    Tor Olsen       TietoEvry            annonserer C++  →   │
│  ●  Lov    Ida Lien        Equinor              tidl. forespørsel →  │
│  ○  Mulig  Anne Berg       Aker BP              ...             →   │
│  ... (4 til, kompakte 30px-rader)                                     │
├──────────────────────────────────────────────────────────────────────┤
│ Spør agenten:  "Hvem trenger C++ akkurat nå?"          ⌘K  [→]      │
│ (svar streames inn rett under feltet — ingen navigering)              │
└──────────────────────────────────────────────────────────────────────┘
```

### Hva forsvinner fra v3

- **"Dagens 3 trekk"** — erstattet av Innboks-puls + Konsulent→Lead + Topp 10. AI-anbefalingene var for vage; de tre nye seksjonene er konkret nytteverdi.
- **`home-focus-brief` edge function** — opprettes ikke. Erstattes av `inbox-pulse` og `consultant-lead-match`.
- **"Hva har endret seg siden du var her sist"** — droppes. Innboks-puls dekker behovet bedre.

### Nye edge functions

**`supabase/functions/inbox-pulse/index.ts`**
- Henter siste 14 dager fra brukerens Outlook (alle e-poster, ikke filtrert på kontakt). Bruker samme token-flyt som `outlook-mail`, men kaller `${GRAPH_BASE}/me/messages?$top=200&$orderby=receivedDateTime desc&$filter=receivedDateTime ge {iso}` per innlogget admin-konto.
- Sender komprimert e-postliste (subject, from, dato, preview) til Lovable AI Gateway (`google/gemini-2.5-flash`).
- Systemprompt: *"Du er salgssjef i STACQ. Identifiser maks 5 e-poster som er handlingsverdige NÅ. Prioriter: ubesvarte kundetråder, e-poster med konkrete behov nevnt, e-poster fra kjente kontakter som ligger ubesvart. Returner JSON `{insights: [{summary, type: 'unanswered'|'buried'|'follow_up', email_id, contact_email, age_days}]}`. Norsk bokmål."*
- Cache 30 min per bruker (in-memory).
- `email_id` brukes i UI for "→ åpne tråd"-lenke som åpner relatert kontakt (slå opp via e-postadresse) eller faller tilbake til Outlook-web URL.

**`supabase/functions/consultant-lead-match/index.ts`**
- Klient sender liste over `{consultant_id, navn, kompetanse[], tilgjengelig_fra}` for ledige konsulenter (≤60d) + topp 30 leads (`{contact_id, navn, selskap, signal, teknologier[], heat_score}`).
- AI matcher hver konsulent mot beste lead basert på teknologi-overlapp + signal-styrke + recency.
- Returnerer `{matches: [{consultant_id, best_contact_id, score, reasoning}]}`.
- Cache 30 min per bruker.

### Direkte queries (ingen AI)

**Nye forespørsler (7d):** `foresporsler` where `mottatt_dato >= now()-7d AND owner_id = current_user OR null` ordered desc, limit 5–10. Felter: dato, selskap (join), teknologier, sted.

**Topp 10 hotteste leads:** Henter alle kontakter eid av brukeren med relasjoner (activities, tasks, foresporsler, company_tech_profile) — *gjenbruker samme query-mønster som Salgsagenten* via en utvunnet `loadHomeQueueData(userId)` i ny `src/lib/homeQueueModel.ts`. Kjør `getHeatResult` per kontakt, sorter på `score`, ta topp 10.

**Tilgjengelige konsulenter:** `stacq_ansatte` where `tilgjengelig_fra is not null AND tilgjengelig_fra <= now()+60d AND status in ('AKTIV/SIGNERT','Ledig')`. Filter med `hasConsultantAvailability` (gjenbruk fra `contactHunt.ts`).

### Designkontrakt (uendret fra v3)

- Kun komponenter fra `src/components/designlab/system/*` og `controls.tsx` + `DesignLabPageShell`.
- Bakgrunn `C.appBg` overalt. Seksjoner skilles med `1px solid C.borderLight` — ingen kort-på-kort.
- Radhøyde 30px. 13px standard tekst, 11px meta.
- Status-prikker fra `HEAT_COLORS` / `SIGNAL_COLORS`.
- Ingen accent-bg på rad-handlinger; accent kun hvis vi har en hovedhandling per seksjon (vi har det ikke nå).

### Tastaturmodell

- `⌘K` — fokuser søkefeltet
- `↑` / `↓` — bytt mellom rader på tvers av seksjoner (innboks, konsulent-match, forespørsler, topp 10)
- `Enter` — åpne målet for valgt rad
- `Esc` — lukk inline AI-svar

### Filer som endres / opprettes

**Endres:**
- `src/pages/DesignLabHome.tsx` — full omskriving etter v3.1-anatomi.
- `src/components/AIChatPanel.tsx` — eksporterer `buildSystemPrompt` og `loadCrmContext` (uendret fra v3).

**Opprettes:**
- `src/lib/aiChatContext.ts` — utvunnet kontekst-bygger (delt mellom `AIChatPanel` og Hjem).
- `src/lib/homeQueueModel.ts` — beregner topp-10 via `getHeatResult`.
- `supabase/functions/inbox-pulse/index.ts` — innboks-skann + AI-oppsummering.
- `supabase/functions/consultant-lead-match/index.ts` — AI-matching av ledige konsulenter mot leads.

**Slettes:**
- `supabase/functions/daily-brief/index.ts` (fra forrige iterasjon).

### Hva som er bevisst utelatt

- Outlook-kalender, "Din dag", roterende placeholders i søk, statiske grafer, markedsradar-widget, mobiloptimalisering, oppgaveopprettelse fra Hjem.
- Brief-stil "gjør X fordi Y" — erstattet av faktiske AI-funn (innboks) og deterministisk match (konsulent→lead).

