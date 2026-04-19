

## Vurdering

Du er på `/design-lab/oppfolginger` (V2-flate), og både `ContactCardContent` og `ForespørselSheet` rendres innenfor V2-skall (`dl-v8-theme`). Da gjelder V2-typografi: 13px / 500 / `#1A1C1F` for tittel, 12px / 400 / dempet for meta. Akkurat nå skriker disse sub-titlene fortsatt V1-uppercase mens resten av kortet leser V2.

**MEN** — `ContactCardContent` brukes også på V1-flater (`/kontakter/:id` via `src/pages/ContactDetail.tsx`), og `ForespørselSheet` brukes også i `/foresporsler` (V1). Endrer vi klassene direkte, bytter vi typografi i V1 også, og det bryter V1-regelen "Ikke endre V1-design". 

### To strategier — én må velges

**Strategi A — Global migrering (anbefalt for konsistens)**: Endre headerne direkte. Pro: konsistens, mindre kodevedlikehold. Kontra: V1-flatene (`/kontakter/:id`, `/foresporsler`) får V2-typografi på disse seksjonene mens resten av V1-siden er uendret → potensielt stilbrudd i V1.

**Strategi B — Variant-flagg**: Legg til en `v2?: boolean` prop som kun aktiverer V2-typografi når komponenten mountes fra `/design-lab/*`. Pro: respekterer V1/V2-skillet. Kontra: mer kompleksitet, dobbelt sett klasser å vedlikeholde.

**Min anbefaling: Strategi A**. Resonnement: V1 og V2 har samme tekstinnhold ("Oppfølginger · 1"), og V2-stilen (13px / 500 / mørk) er ikke verre i V1-sammenheng — den er bare litt mer dempet enn V1-uppercase. Og siden vi allerede har migrert "Oppfølginger / Aktiviteter / Kontakter" på selskapskortet uten variant-flagg, er det konsekvent å gjøre det samme her. Hvis det skurrer i V1 kan vi raskt rulle tilbake til variant-løsning.

## Funn — eksakt liste over headere som migreres

### `src/components/ContactCardContent.tsx` (Kontaktkortet)
1. **Linje 1254** — "Teknologier" (i Tekniske behov-seksjonen)
2. **Linje 1677** — "Oppfølginger · {tasks.length}" (oppfølgings-seksjonen, samme V1-kort-wrapper som vi nettopp ryddet på selskapskortet)

### `src/components/ForespørselSheet.tsx` (Forespørselskortet, read-only visning)
3. **Linje 746** — "Mottatt"
4. **Linje 773** — "Teknologier"  
5. **Linje 873** — "Kommentar"

Alle bruker konstanten `LABEL` (linje 45) eller den dupliserte versjonen i EditMode (linje 1197):
```ts
const LABEL = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
```

## Plan

### 1. `src/components/ForespørselSheet.tsx`
Endre `LABEL`-konstanten på **linje 45** (read-only/preview-mode) til V2-stil:

```ts
const LABEL = "text-[12px] font-medium text-[#5C636E]";
```

Dette løfter automatisk Mottatt, Teknologier, Kommentar, Konsulentmatch, Sendt inn, og alle andre `${LABEL}`-bruk i preview-grenen til V2 i ett kutt.

**Viktig**: Den dupliserte `LABEL` på **linje 1197** ligger inne i `EditMode`-komponenten (skjema med inputs). Der ER uppercase-labels et legitimt skjemadesign-mønster (input-feltlabels skal være tydelige og distinkte fra verdier). Vi lar den være — kun preview-LABEL endres.

### 2. `src/components/ContactCardContent.tsx`

**Linje 1252–1256** ("Teknologier"-header):
```tsx
<div className="flex items-center justify-between mb-3" style={{ minHeight: 32 }}>
  <h3 className="text-[13px] font-medium text-[#1A1C1F]">
    Teknologier
  </h3>
  ...
```
Bytter `<span>` → `<h3>` (semantisk konsistent med Aktiviteter/Kontakter/Oppfølginger), 13px / 500 / `#1A1C1F`. Ingen teller her, så ingen dempet `<span>`-del.

**Linje 1675–1680** (Oppfølginger-headeren):
- Erstatt header med samme V2-mønster:
```tsx
<div className="flex items-center justify-between mb-3" style={{ minHeight: 32 }}>
  <h3 className="text-[13px] font-medium text-[#1A1C1F]">
    Oppfølginger <span className="font-normal text-[#8C929C]">· {tasks.length}</span>
  </h3>
</div>
```
- Vurdering om kort-wrapperen (`bg-card border border-border rounded-lg shadow-card p-4`): samme situasjon som vi diskuterte på selskapskortet. **Holder vi scope tett denne runden**: behold wrapperen, kun typografi-fiks. Kan ryddes i en oppfølgende runde.

## Designvalg (kort)

- **Tittel (Mottatt, Teknologier, Kommentar)**: 13px på selskapskort vs 12px her? På selskapskortet brukte vi 13px fordi titlene var "primære innganger til kolonner". Her er Mottatt/Teknologier/Kommentar **felt-labels** i en mer skjema-aktig liste — 12px / 500 / `C.textMuted` (#5C636E) er V2-standard for "metadata/labels" (jf. project-knowledge: "Sekundærtitler 12–13px"). 

  → **Velger 12px / 500 / #5C636E** for ForespørselSheet-feltene. Det matcher V2-tokens og bevarer tydelig skille mellom label og verdi (som vises i 13px / `C.text` under).

- **Oppfølginger-headeren i ContactCardContent**: Dette ER en kolonneheader (over en liste), så her bruker vi **samme mønster som selskapskortet**: 13px / 500 / `#1A1C1F` + dempet teller. Konsistent med tidligere migrering.

- **Teknologier-headeren i ContactCardContent**: Også en seksjonsheader med høyre-stilt knapp ("Finn konsulent"), ikke et skjema-felt → **13px / 500 / `#1A1C1F`**, samme som Oppfølginger. Konsistent kolonneheader-mønster.

Kort sagt: to ulike V2-nivåer brukt riktig:
- **Kolonneheadere over lister** (Oppfølginger, Teknologier-seksjon): 13px / 500 / mørk
- **Felt-labels i skjema-aktig info-rad** (Mottatt, Teknologier-chips, Kommentar i ForespørselSheet): 12px / 500 / dempet

## Filer som endres
- `src/components/ForespørselSheet.tsx` — én konstant-endring (linje 45)
- `src/components/ContactCardContent.tsx` — to header-erstatninger (linjer 1252–1256, 1675–1680)

## Utenfor scope
- EditMode-skjema-labels i ForespørselSheet (linje 1197) — uppercase er legitimt skjemadesign der
- Andre uppercase-labels i ContactCardContent som tilhører edit-skjemaer (Tittel, Kategori, Når? — alle inne i `activeForm`-grenen, brukes ved opprettelse av ny aktivitet)
- Kort-wrapperen rundt Oppfølginger i ContactCardContent — vurderes i egen runde
- V1-spesifikke flater (`/foresporsler`, `/kontakter/:id`) — får samme typografi som side-effekt av endringene; aksepteres som anbefalt strategi A

