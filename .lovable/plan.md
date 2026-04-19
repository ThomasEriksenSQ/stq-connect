

## Funn

I `ContactCardContent.tsx` (referansedesign) brukes denne stilen for seksjonstitler som "Teknologier":
```tsx
<h3 className="text-[13px] font-medium text-[#1A1C1F]">Teknologier</h3>
```
- 13px, font-weight 500, mørk tekst (`#1A1C1F` = `C.text`).

I `ExternalConsultantDetailCard` (linje 464–595 i `src/pages/EksterneKonsulenter.tsx`) brukes derimot:
```tsx
<p style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>Kontakt</p>
```
- 11px, dempet grå (`C.textFaint`).

Det forklarer at "Kontakt", "Teknologier", "Oppdragsmatch" (og "Kommentar") på Ekstern-siden ser små og bleke ut sammenlignet med Kontaktkortet.

## Plan

Oppdater de fire seksjonstitlene i `ExternalConsultantDetailCard` slik at de matcher Kontaktkortet 1:1.

### Fil som endres
- `src/pages/EksterneKonsulenter.tsx` (4 linjer: 523, 545, 562, 579)

### Endring
Bytt ut hver av disse:
```tsx
<p style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>Kontakt</p>
<p style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>Teknologier</p>
<p style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>Kommentar</p>
<p style={{ fontSize: 11, fontWeight: 500, color: C.textFaint }}>Oppdragsmatch</p>
```
med:
```tsx
<h3 className="text-[13px] font-medium text-[#1A1C1F]">Kontakt</h3>
<h3 className="text-[13px] font-medium text-[#1A1C1F]">Teknologier</h3>
<h3 className="text-[13px] font-medium text-[#1A1C1F]">Kommentar</h3>
<h3 className="text-[13px] font-medium text-[#1A1C1F]">Oppdragsmatch</h3>
```

Ingen andre stiler, layout eller logikk endres. Siden `DesignLabEksterneKonsulenter.tsx` gjenbruker `ExternalConsultantDetailCard`, slår fiksen igjennom på begge flater (V1 og V2).

## Hvorfor lav-risk

- Kun fire linjer endres, kun visuell stil på etiketter.
- Ingen påvirkning på data, layout-grid, knapper eller `OppdragsMatchPanel`.
- Konsekvent med Kontaktkortet, som er fasit.

## Utenfor scope

- Andre tekstelementer i kortet (verdier, ikoner, tag-stiler) — uendret.
- Ansatte-kortet og andre detaljpaneler — ikke berørt.

