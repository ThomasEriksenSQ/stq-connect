

# Plan: Legg til "Tilgjengelig for oppdrag"-seksjon i Design Lab

## Hva skal gjøres

Legge til en horisontal rad med konsulenter som er tilgjengelige for oppdrag, plassert mellom header/filtre og kontaktlisten. Designet matcher referansebildet: konsulent-kort med initialer (avatar), fullt navn og tilgjengelighetsdato i en horisontal scrollbar.

## Visuell stil

```text
TILGJENGELIG FOR OPPDRAG
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ [TL] Tom Erik ...    │  │ [HM] Harald Ivarson..│  │ [TE] Trond Hübertz.. │
│ Tilgjengelig om 10d  │  │ Tilgjengelig 1. sep. │  │ Tilgjengelig 1. sep. │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

- Seksjonstittel: 11px uppercase, fontWeight 600, tracking 0.06em, color `C.textMuted`
- Kort: rounded-lg, border `C.border`, padding 10px 14px, horisontal layout med avatar + tekst
- Avatar: 36px sirkel, bg `rgba(40,37,29,0.08)`, initialer 12px fontWeight 600
- Tilgjengelighetstekst: 12px, fargekoding via `getConsultantAvailabilityMeta` (ready=emerald, soon=amber, later=muted)
- Horisontal scroll med `overflow-x-auto`, ingen scrollbar synlig (webkit-scrollbar hidden)

## Tekniske endringer

### `src/pages/DesignLabContacts.tsx`

1. **Ny query**: Hent `stacq_ansatte` med status "Ledig" og `tilgjengelig_fra` not null, select `id, navn, tilgjengelig_fra`
2. **Sortere og filtrere** med eksisterende `sortHuntConsultants` og `hasConsultantAvailability` fra `@/lib/contactHunt`
3. **Ny komponent `AvailableConsultantsBar`**: Rendrer horisontalt scrollbar med kort, plassert rett under filterraden
4. **Beregn initialer** fra konsulentens navn (første bokstav i for- og etternavn)
5. **Import** `getConsultantAvailabilityMeta`, `hasConsultantAvailability`, `sortHuntConsultants` fra `@/lib/contactHunt`

