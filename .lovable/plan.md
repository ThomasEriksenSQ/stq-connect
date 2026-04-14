

# Plan: Design Lab — Kontaktdetaljside inspirert av Balkan.team

## Konsept

Inspirert av referansebildet: en to-kolonne layout der **venstre kolonne** er en kompakt kontaktinfo-seksjon (avatar, navn, selskap, status, kontaktinfo, egenskaper), og **høyre kolonne** er tabulert innhold (Aktivitet, Oppfølginger, Konsulenter). Clean, hvitt, minimalt — men med EKTE data fra Supabase.

```text
┌─ AppLayout sidebar ─┬────────────────────────────────────────────────────────┐
│  Dashboard           │  Kontakter › Erik Solberg                             │
│  Kontakter           │                                                       │
│  Selskaper           │  ┌─ VENSTRE (320px) ──┐  ┌─ HØYRE (flex) ──────────┐ │
│  Oppdrag             │  │                     │  │                          │ │
│  ...                 │  │  [Avatar]            │  │ Aktivitet│Oppfølginger  │ │
│                      │  │  Erik Solberg        │  │                          │ │
│                      │  │  Tech Lead           │  │ Erik Solberg             │ │
│                      │  │  Aker Solutions      │  │ @Jon Richard Nygaard     │ │
│                      │  │  ● Behov nå          │  │ Diskuterte ML-behov...   │ │
│                      │  │                     │  │                          │ │
│                      │  │  [📞] [✉] [in] [📋] │  │ Kari Hansen              │ │
│                      │  │                     │  │ @Thomas Eriksen          │ │
│                      │  │  Kontaktinfo         │  │ Gjennomgang av team...   │ │
│                      │  │  erik@aker...     📋 │  │                          │ │
│                      │  │  +47 901 23 456      │  │                          │ │
│                      │  │  Oslo                │  │                          │ │
│                      │  │                     │  │                          │ │
│                      │  │  Eier                │  │                          │ │
│                      │  │  Jon Richard N.  ▾   │  │                          │ │
│                      │  │                     │  │                          │ │
│                      │  │  Signal              │  │                          │ │
│                      │  │  ● Behov nå      ▾   │  │                          │ │
│                      │  │                     │  │                          │ │
│                      │  │  ── Status ──        │  │                          │ │
│                      │  │  CV-Epost    ✓       │  │                          │ │
│                      │  │  Innkjøper   ✗       │  │                          │ │
│                      │  │                     │  │                          │ │
│                      │  │  ── Teknisk DNA ──   │  │                          │ │
│                      │  │  Python PyTorch      │  │                          │ │
│                      │  └─────────────────────┘  └──────────────────────────┘ │
└──────────────────────┴────────────────────────────────────────────────────────┘
```

## Hva er genuint annerledes

| Element | Nåværende Design Lab | Ny retning |
|---------|---------------------|------------|
| **Meny** | Egen TopNav (duplikat) | Bruker AppLayout sidebar — ekte app-opplevelse |
| **Data** | Mockdata (hardkodet) | Ekte Supabase-data via queries |
| **Kontaktinfo** | Sidebar til høyre som key-value liste | Venstre kontaktkort med avatar, action-ikoner, properties |
| **Innhold** | Tabs + highlight-kort | Ren tabulert innholdsseksjon til høyre, ingen KPI-kort |
| **Actions** | Knapper i header | Ikonrad under avatar (telefon, e-post, linkedin, kopier) |
| **Visuell stil** | Hardkodede hex-verdier | Ren hvit, subtile borders, avatar med initialer, clean properties |

## Visuelt system

- Hvit bakgrunn, `border-border` for skillelinjer
- Avatar: 80px rund sirkel med initialer, `bg-muted`
- Breadcrumb: "Kontakter › Erik Solberg" med link tilbake
- Kontaktinfo-properties: label-verdi par med copy-knapp på e-post
- Action-ikoner: runde/kvadratiske ghost-knapper i en rad (telefon, e-post, linkedin, kalender, mer)
- Tabs: understrek-stil, clean
- Ingen highlight-kort / KPI-bokser — la dataen snakke

## Ekte data

Bruker eksisterende Supabase-queries fra `ContactCardContent.tsx`:
- `contacts` med join på `companies` og `profiles`
- `activities` sortert synkende
- `tasks` (oppfølginger) filtrert på ikke-done
- Konsulentmatch via `match-consultants` edge function

## Filer som endres

1. **`src/pages/DesignLabContactDetail.tsx`** — Fullstendig omskrivning:
   - Fjern TopNav, mock-data, highlight-widgets
   - Hent ekte data fra Supabase (contacts, activities, tasks)
   - To-kolonne layout: venstre kontaktkort (320px) + høyre tabulert innhold
   - Avatar med initialer, action-ikonrad, property-liste
   - Tabs: Aktivitet, Oppfølginger, Konsulenter

2. **`src/pages/DesignLabContacts.tsx`** — Liten endring: fjern TopNav-wrapper, la den brukes innenfor AppLayout (rutene bruker allerede AppLayout)

## Ikke berørt
- Ingen endring i AppLayout, App.tsx, eller eksisterende CRM-sider
- Kontaktlisten beholder spreadsheet-stil men med ekte data-navigasjon

