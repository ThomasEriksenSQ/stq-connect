

## Mål
1. Stoppe at teknologi-chipsene flyter inn i Konsulent-kolonnen.
2. Matche konsulent-radenes stil i Forespørsler med stilen i Ansatte-tabellen (samme avatar-størrelse 32px, samme tekstfarge/vekt).

## Funn

### Problem 1: Teknologier "krasjer" inn i Konsulent
`src/pages/DesignLabForesporsler.tsx` linje 584–600:
```tsx
<div className="min-w-0 pr-4">
  <div className="flex items-center gap-1.5 flex-nowrap">
    {technologies.visible.map(...)}
```
- `flex-nowrap` + ingen `overflow:hidden` på cellen = chips renderes utenfor cellebredden uten å bli klippet.
- `getVisibleTechnologies` (linje 71) bruker `charBudget = 24` som er for sjenerøst når kolonnen er smal (ca. 180–230px). Resultat: 2 chips med lange navn (f.eks. "Embedded systems" + "TMS570") sprenger kolonnen.

### Problem 2: Konsulent-stil vs. Ansatte-stil
Forespørsler (linje 615–643): avatar 22×22, tekst `fontSize: 12, color: C.textMuted`.
Ansatte (linje 281–290): avatar `h-8 w-8` (32×32), tekst `fontSize: 13, fontWeight: 500, color: C.text`.

## Endringer (én fil: `src/pages/DesignLabForesporsler.tsx`)

### 1. Forhindre overflow i Teknologier-cellen
Linje 584:
```tsx
<div className="min-w-0 pr-4" style={{ overflow: "hidden" }}>
```
Linje 585 — bytt fra `flex-nowrap` til wrap-tilltatt med skjult overflow:
```tsx
<div className="flex items-center gap-1.5 flex-nowrap" style={{ minWidth: 0, overflow: "hidden" }}>
```

### 2. Stram inn `getVisibleTechnologies` charBudget
Linje 79: `let charBudget = 24;` → `let charBudget = 18;`
Gir bedre plass for lange tag-navn ("Embedded systems", "Embedded Linux") slik at kun 1 chip + "+N" vises når plassen er trang.

### 3. Match avatar + tekst-stil til Ansatte
Linje 615–643 — oppdater radens avatar fra 22→32px og tekst fra 12/textMuted → 13/500/text:
```tsx
<div key={k.id} style={{ minHeight: 32, display: "flex", alignItems: "center", gap: 12 }}>
  {portrait ? (
    <img src={portrait} alt={navn}
      className="h-8 w-8 rounded-full border object-cover"
      style={{ borderColor: C.border, flexShrink: 0 }}
    />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full"
      style={{ background: C.accentBg, color: C.accent, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
    >
      {getInitials(navn)}
    </div>
  )}
  <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
    {navn}
  </span>
</div>
```
Status-celle (linje 656–678): hev `minHeight` fra 28 → 32 så pipeline-chipsen står sentrert i forhold til den nye, høyere konsulent-raden.

## Effekt
- Teknologi-chips holder seg innenfor sin egen kolonne (klippes med "+N" indikator når plassen er trang).
- Konsulent-rader i Forespørsler får eksakt samme visuelle vekt som i Ansatte-tabellen (32px avatar, 13px medium-vekt navn i full tekstfarge).
- Tomme rader (uten konsulenter) beholder ~38px høyde — konsulent-rader vokser nå til ~32px per konsulent (fra 28px), naturlig høyere ved flere konsulenter.

## Utenfor scope
- Ingen endring i kolonnedefinisjon eller header.
- Ingen endring i V1 `/foresporsler`.
- Ingen endring i `DesignLabReadonlyChip`-komponenten (kun parent-cellen håndteres).

