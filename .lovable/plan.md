

# Plan: Design Lab V8 — "Linear meets B2B Sales"

## Konsept

Fullstendig visuell overhaul basert på Linear's light mode-filosofi: varm off-white, muted teal accent, ultra-subtile borders, og en 3-sone layout der kontaktdetaljer glir inn som et høyre-panel — ikke en separat side.

## Arkitektur-endring

Dagens Design Lab har to separate sider (liste + detaljside). Ny versjon slår dem sammen til **én side med sliding detail panel**:

```text
┌─ AppLayout header ──────────────────────────────────────────────────────┐
│  STACQ    Salgsagent  Selskaper  Kontakter  Forespørsler  ...          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Søkefelt (pill, sentrert) ─────────────────────────┐               │
│                                                                         │
│  Kontakter  142                      [+ Legg til kontakt]              │
│  [Eier ▾] [Signal ▾]                                                   │
│                                                                         │
│  ┌─ KONTAKTLISTE ──────────────────┐  ┌─ DETALJPANEL (340px) ────────┐ │
│  │ Navn          Selskap  Signal   │  │  ← Henrik Berg               │ │
│  │─────────────────────────────────│  │  Platform Lead · Equinor     │ │
│  │ Henrik Berg   Equinor  ● Behov  │  │  ● Behov nå                  │ │
│  │ Kari Hansen   DNB      ● Ukjent │  │                              │ │
│  │ ...                             │  │  [📞] [✉] [in]              │ │
│  │                                 │  │                              │ │
│  │                                 │  │  NESTE STEG                  │ │
│  │                                 │  │  Presentere Kristian H.      │ │
│  │                                 │  │                              │ │
│  │                                 │  │  ── Kontakt ──               │ │
│  │                                 │  │  henrik@equinor.com          │ │
│  │                                 │  │  +47 966 77 888              │ │
│  │                                 │  │                              │ │
│  │                                 │  │  ── Aktivitet ──             │ │
│  │                                 │  │  12. apr — DevOps-behov...   │ │
│  │                                 │  │  14. mar — Første møte       │ │
│  └─────────────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Visuelt system (bryter med project-knowledge for Design Lab)

| Element | Verdi |
|---------|-------|
| Bakgrunn | `#F7F6F2` (varm off-white) |
| Tekst primær | `#28251D` (dyp grafitt) |
| Tekst muted | `#7A7974` |
| Tekst faint | `#BAB9B4` |
| Accent (teal) | `#01696F` — kun aktiv nav, primærknapp, fokus |
| Borders | `rgba(40,37,29,0.08)` — 1px |
| Skygger | `0 1px 2px rgba(40,37,29,0.04)` kun på kort |
| Border-radius | 8px kort, 6px inputs, full-rounded badges |
| Font | Inter, 16px base |
| Labels/nav | 13px / 500 |
| Section headings | 18px / 600 |
| Page title | 22px / 600 |

## Status-chips

Bytt fra fargede badges til nøytrale + teal:
- **Behov nå**: teal bakgrunn-tint (`#01696F` text, `rgba(1,105,111,0.08)` bg)
- **Fremtidig/Kanskje/Ukjent**: nøytrale grå (`#7A7974` text, `rgba(40,37,29,0.06)` bg)
- **Ikke aktuelt**: litt mørkere grå

## Interaksjon

- Klikk på rad → høyre detaljpanel glir inn (CSS transition, 340px)
- Hover på rad: `#F3F0EC` bakgrunn, ingen border-endring
- Aktiv rad: subtil teal venstre-border (2px)
- Tom tilstand (ingen valgt): sentrert ikon + kort melding

## Detaljpanelet (340px)

Inneholder alt fra dagens detaljside, komprimert:
- Navn, stilling, selskap
- Signal-badge
- Action-ikoner (telefon, e-post, LinkedIn)
- "Neste steg" felt øverst (første oppfølging)
- Kontaktinfo (e-post, telefon, sted)
- Eier
- Status-toggles
- Teknisk DNA tags
- Siste aktiviteter (kompakt liste, maks 5)

## Ekte data

Beholder alle eksisterende Supabase-queries fra nåværende implementasjon (contacts, activities, tasks). Detaljpanelet henter data on-demand når en rad velges.

## Filer som endres

1. **`src/pages/DesignLabContacts.tsx`** — Fullstendig omskrivning:
   - 3-sone layout med kontaktliste + sliding detaljpanel
   - Nytt fargesystem med CSS custom properties
   - Pill-formet søkefelt
   - Nye nøytrale status-chips
   - Detaljpanel med all kontaktinfo, aktiviteter og oppfølginger
   - Hover/aktiv states

2. **`src/pages/DesignLabContactDetail.tsx`** — Tømmes til en redirect til `/design-lab/kontakter?contact=:id` (detaljvisningen er nå i panelet)

3. **`src/App.tsx`** — Fjern ruten for `design-lab/kontakter/:id` (ikke lenger nødvendig)

## Ikke berørt
- AppLayout, eksisterende CRM-sider, Supabase-schema

