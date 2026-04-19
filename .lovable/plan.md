

## Vurdering

Ja — definitivt. "Oppfølginger · 1" bruker fortsatt **gammel V1-typografi** (uppercase, 11px, bold, tracking) mens vi nettopp har løftet "Aktiviteter" og "Kontakter" til V2-standard (13px / 500 / `#1A1C1F` + dempet teller). Det blir et tydelig stilbrudd i samme kort: én header skriker "LABEL", de to andre leser som rolige primær-innganger.

Siden vi er på `/design-lab/selskaper` (V2-flate) skal alle tre kolonneheaderne følge samme V2-mønster.

## Funn

`src/components/CompanyCardContent.tsx` linje 1015–1017:
```tsx
<h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
  Oppfølginger · {tasks.length}
</h3>
```

Dette er V1-seksjonstittel (11px / bold / uppercase / tracking 0.08em / muted) — samme mønster som ble brukt før vi migrerte Aktiviteter og Kontakter.

Til sammenligning (nåværende V2-mønster, linje 1119 og 2162/2174):
```tsx
<h3 className="text-[13px] font-medium text-[#1A1C1F]">
  Kontakter <span className="font-normal text-[#8C929C]">· {contacts.length}</span>
</h3>
```

## Plan

**Én endring i `src/components/CompanyCardContent.tsx` linje 1014–1018**:

```tsx
<div className="flex items-center mb-3" style={{ minHeight: 32 }}>
  <h3 className="text-[13px] font-medium text-[#1A1C1F]">
    Oppfølginger <span className="font-normal text-[#8C929C]">· {tasks.length}</span>
  </h3>
</div>
```

Dette gir:
- Samme typografi (13px / 500 / `#1A1C1F`) som Aktiviteter og Kontakter
- Samme dempet teller-mønster (`#8C929C` / 400)
- Samme `min-height: 32px` + `mb-3` så baseline-aligneringen er konsistent
- `mb-2` → `mb-3` for å matche de andre headerne

## Bonus-vurdering (kan tas i samme runde)

Selve oppfølgings-kortet ligger fortsatt i en V1-container: `bg-card border border-border rounded-lg shadow-card p-4` (linje 1013). Dette er kort-på-kort layout som V2 eksplisitt skal unngå ("kort-på-kort layout" står i feillisten).

**Anbefaling**: fjern også kort-wrapperen så Oppfølginger flyter som en seksjon på linje med Aktiviteter og Kontakter — bare header + liste, ingen ekstra ramme/skygge. Det gir tre konsistente kolonneseksjoner.

Hvis du vil holde scope tett i denne runden, gjør vi kun typografi-fiksen og lar kort-wrapperen vente.

## Filer som endres
- `src/components/CompanyCardContent.tsx` — header-erstatning på linje 1014–1018 (+ valgfritt: fjern kort-wrapper på linje 1013).

## Utenfor scope
- Andre seksjoner (Notater, Teknisk DNA-headeren).
- Selve oppfølgingsradenes innhold/layout.

