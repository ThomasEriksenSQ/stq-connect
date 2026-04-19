

## Mål
Vise ekstern konsulent-detaljer i høyre panel på `/design-lab/eksterne` med samme V2/Design Lab-shell som kontaktkortet på `/design-lab/kontakter`.

## Funn
**Kontaktpanel (`DesignLabContacts.tsx` linje 2403–2450):**
- Wrapper: `h-full flex flex-col` med `background: C.panel`, `borderLeft: 1px solid C.borderLight`
- Topp-bar: 32px høy, kun X-knapp (`DesignLabIconButton`) høyrejustert
- Innhold: `flex-1 overflow-y-auto px-6 py-5 dl-v8-theme`
- Selve innholdet rendres via en delt komponent (`ContactCardContent`)

**Eksternt panel (`EksterneKonsulenter.tsx` linje 326–343, `ExternalConsultantDetailCard` linje 439–579):**
- Wrapper: `border border-border rounded-lg bg-card` (kort-stil, V1-aktig)
- Egen header med "KONSULENTPROFIL"-label + Rediger/Lukk-knapper i én rad
- Bruker `text-[1.5rem] font-bold`, `text-[0.6875rem] uppercase` osv. (V1-typografi)
- Mangler `dl-v8-theme`-klasse og V2-tokens (`C.panel`, `C.borderLight`)

## Plan

### 1. Oppdatere shell-wrapper i `EksterneKonsulenter.tsx` (linje 325–344)
Erstatte `<div className="h-full rounded-lg border border-border bg-card overflow-hidden">` med samme struktur som kontaktpanelet:
```tsx
<div className="h-full flex flex-col" style={{ background: C.panel, borderLeft: `1px solid ${C.borderLight}` }}>
  <div className="shrink-0 flex items-center justify-end px-4" style={{ height: 32 }}>
    <DesignLabIconButton onClick={onClear} title="Lukk panel">
      <X style={{ width: 16, height: 16 }} />
    </DesignLabIconButton>
  </div>
  <div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
    <ExternalConsultantDetailCard row={selectedRow} onEdit={() => openEdit(selectedRow)} />
  </div>
</div>
```
- Importere `DesignLabIconButton` fra `@/components/designlab/controls`
- Lukk-knapp flyttes ut av `ExternalConsultantDetailCard` og opp i shell (samme mønster som kontaktpanelet)

### 2. Forenkle `ExternalConsultantDetailCard` (linje 439–579)
- Fjerne ytre `overflow-y-auto` (skjer nå i shell)
- Fjerne den egne header-raden (KONSULENTPROFIL + Rediger + Lukk) — beholde bare Rediger-knappen plassert øverst i kortet (eller som en inline action ved navnet)
- Fjerne padding-wrapper `px-5 py-5`, la shellets `px-6 py-5` styre
- Konvertere `space-y-6` indre seksjoner til samme tetthet som kontaktkortet
- Beholde innholdsstrukturen: navn, kontakt-info, teknologier, kommentar, OppdragsMatchPanel
- Tilpasse typografi til V2/Design Lab nivå: navn 18–20px / 600 (ikke 1.5rem bold), labels 11px medium uten uppercase-vekt-overdrivelse

### 3. Plassering av Rediger-knapp
Plasser "Rediger"-knappen i øvre høyre hjørne av selve kortinnholdet (over navn), slik kontaktkortet håndterer sine handlinger via `enableProfileEditMode`-mønsteret. Bruke `DesignLabSecondaryAction` eller eksisterende inline action-stil.

## Effekt
- Høyre panel på `/design-lab/eksterne` får samme visuelle ramme som kontaktkortet: hvit panel-bakgrunn, venstre kant-border, 32px topp-bar med X-knapp, scroll i innhold, V2-typografi via `dl-v8-theme`.
- Innholdet (navn, teknologier, oppdragsmatch) beholdes uendret funksjonelt.

## Utenfor scope
- Endre selve `ContactCardContent` eller bygge ekstern variant av den.
- Endre tabellen til venstre eller filterene.
- Endre redigeringsmodalen (`ConsultantModal`).

