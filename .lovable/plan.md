

## Mål
Gi `Nytt selskap`- og `Ny kontakt`-panelene på Design Lab-flatene samme visuelle uttrykk som `OppdragEditSheet` (se vedlagt "Anders Larsen"-skjermbilde): hvit 920px sheet, fet 1.25rem-tittel, mørke "valgt"-chips (`bg-foreground text-background`), beregnet-felt med `bg-muted/30`-boks der relevant, blå primærknapp + grå sekundær i bunn-footer.

## Funn
- **Referansen** (`src/components/OppdragEditSheet.tsx`) bruker:
  - 920px `Sheet` (slides fra høyre)
  - Header: `px-6 py-5 border-b`, tittel `text-[1.25rem] font-bold`, deretter feltgruppe (Konsulenttype/Konsulent/Kunde) med `LABEL` (11px uppercase) + `CHIP_BASE` chips
  - Body: `flex-1 overflow-y-auto px-6 py-5 space-y-5` med STATUS/TYPE-chips og inputs (`Input` + `text-[0.875rem]`)
  - Footer: `px-6 py-4 border-t`, to flex-1-knapper (Avbryt: outlined; Lagre: `bg-primary`), valgfri `Avslutt oppdrag`-link under
- **Dagens overlays** (`DesignLabCompanies.tsx` linje 672–820 og `CompanyCardContent.tsx` linje 1117–1293) bruker V2-stack: `DesignLabFormSheet` + `DesignLabModalInput`/`DesignLabFilterButton`/`DesignLabPrimaryAction` med accent #5E6AD2 og text-size-skalering.

## Løsning
Bygg én ny gjenbrukbar V1-stilet sheet-shell og bruk den for begge create-flytene. Behold all eksisterende forretningslogikk (BRREG, mutations, validering) — kun presentasjonen byttes ut.

### 1) Ny komponent `src/components/designlab/AktivOppdragStyleSheet.tsx`
Tynn shell som speiler OppdragEditSheet sin layout:
```
<Sheet> → <SheetContent side="right" w-full sm:w-[920px] p-0 hideCloseButton>
  <div className="flex flex-col h-full">
    <header className="px-6 py-5 border-b border-border">
      <h2 className="text-[1.25rem] font-bold text-foreground">{title}</h2>
      {headerSlot}   ← første feltgruppe (f.eks. Selskapsnavn / Fornavn+Etternavn)
    </header>
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {children}     ← resterende felter
    </div>
    <footer className="px-6 py-4 border-t border-border">
      <div className="flex gap-3">
        <button … border-border>Avbryt</button>
        <button … bg-primary text-primary-foreground>{submitLabel}</button>
      </div>
    </footer>
  </div>
</Sheet>
```
Eksporter også gjenbrukbare primitiver som matcher referansen:
- `LABEL` = `text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground`
- `CHIP_BASE` + `chipActive`/`chipInactive` (samme `bg-foreground text-background border-foreground` for valgt)
- `inputClass` = `mt-1 text-[0.875rem]` på shadcn `<Input>`
- `<MarginBox>` (valgfri) = `rounded-lg border border-border bg-muted/30 px-4 py-3`

Ingen text-size-skalering, ingen V2-tokens — ren V1-typografi/farger som referansen.

### 2) `src/pages/DesignLabCompanies.tsx` — `Nytt selskap`
- Bytt `DesignLabFormSheet` + `DesignLabFormSheetHeader/Body/Footer` (linje 672–~820) til `AktivOppdragStyleSheet` med `title="Nytt selskap"`
- Felter mappes 1:1 (Selskapsnavn via `BrregSearch`, Org.nr via `OrgNrInput`, Geografisk sted, Nettside, LinkedIn, Type, Eier) men bruk:
  - `<Input className="mt-1 text-[0.875rem]">` i stedet for `DesignLabModalInput`
  - Mørke chips (`bg-foreground text-background`) for Type/Eier i stedet for `DesignLabFilterButton`
  - `LABEL`-klassen i stedet for `DesignLabSectionLabel`
- Footer-knapper: standard Avbryt (outlined) + "Opprett selskap" (`bg-primary`)
- All mutation/validation-logikk uendret

### 3) `src/components/CompanyCardContent.tsx` — `Ny kontakt`
- Samme behandling for blokken på linje 1117–1293
- Felter mappes (Fornavn, Etternavn, Stilling, E-post, Telefon, LinkedIn, Geografisk sted, Egenskaper) til V1-input + V1-chips
- Submit-knapp: "Opprett kontakt" (`bg-primary`)
- Siden komponenten brukes både i Design Lab (embed) og V1 selskapsside, gating av endringen via en eksisterende `editable`/embed-kontekst — enklest: la `CompanyCardContent` ta en ny prop `useV1CreateSheet?: boolean` (default true innenfor Design Lab embed). Vi setter den fra `DesignLabCompanies.tsx` der `CompanyCardContent` mountes (linje ~637). V1-CRM-flater (`/selskaper/[id]`) får uendret oppførsel.

### 4) Visuelt resultat
```
┌──────────────────────────── 920px ───────────────────────────┐
│ Nytt selskap                                                 │
│                                                              │
│ SELSKAPSNAVN                                                 │
│ [ BRREG-søk …                                              ] │
│ ORGANISASJONSNUMMER                                          │
│ [ 123 456 789                                              ] │
├──────────────────────────────────────────────────────────────┤
│ GEOGRAFISK STED                                              │
│ [ By eller sted                              ]  + Legg til   │
│                                                              │
│ NETTSIDE              │ LINKEDIN                             │
│ [ https://         ]  │ [ https://linkedin.com/…          ]  │
│                                                              │
│ TYPE                                                         │
│ [Kunde] [Partner] [Prospect]   ← mørk fyll når valgt          │
│                                                              │
│ EIER                                                         │
│ [Jon Richard Nygaard] [Thomas Eriksen]                       │
├──────────────────────────────────────────────────────────────┤
│ [   Avbryt   ]  [   Opprett selskap   ]   ← blå primær       │
└──────────────────────────────────────────────────────────────┘
```

## Filer som endres
- `src/components/designlab/AktivOppdragStyleSheet.tsx` — ny gjenbrukbar shell + primitiver
- `src/pages/DesignLabCompanies.tsx` — bytt overlay-rendering (kun create-blokken)
- `src/components/CompanyCardContent.tsx` — bytt "Ny kontakt"-overlay bak `useV1CreateSheet`-prop
- (kall-stedet) `src/pages/DesignLabCompanies.tsx` setter propen til `true` når den mountes i Design Lab

## Utenfor scope
- V1-flatene `/selskaper` og `/selskaper/[id]` (uendret)
- Endre selve `OppdragEditSheet` eller knytte den til V2
- Endre andre Design Lab-overlays (forespørsler, oppfølginger, eksterne)
- Text-size-skalering på de nye overlayene (følger V1-stil → fast typografi som referansen)

