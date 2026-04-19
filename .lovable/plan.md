

## Mål
"Aktiviteter · N" (venstre kolonne) og "Kontakter · N" (høyre kolonne) skal stå på **nøyaktig samme horisontale linje** rett under den fulle streken, slik at to-kolonne-layouten leser som en ren, balansert struktur. Gjelder når det ikke finnes en Oppfølging-blokk eller Teknisk DNA over Aktiviteter — da er Aktiviteter første element i venstre kolonne og må linjeres med Kontakter-headeren til høyre.

## Funn
- Venstre kolonne (`companyDetailSections`, linje 792–1114):
  - Teknisk DNA (valgfri) → Oppfølginger-kort (kun hvis `tasks.length > 0`) → `<div className="mt-5">` rundt `CompanyActivityTimeline`.
  - Tidslinjens header er `<h3 className="text-[12px] font-medium text-[#5C636E] mb-3">Aktiviteter · N</h3>` (linje 2171).
- Høyre kolonne (`relatedContactsContent`, linje 1116–):
  - Wrapper `pt-4 md:pt-0` → header-rad `mb-2 flex items-center justify-between` med `<h3 className="text-[12px] font-medium text-[#5C636E]">Kontakter · N</h3>` + `Ny kontakt`-knappen (`DesignLabPrimaryAction`, ~28–32px høy).
- I to-kolonne-visningen (linje 2095–2117) ligger venstre i `<div className="pr-5">` og høyre i `<div className="pl-4">`. Begge kolonner starter på samme topp.

**Hvorfor de ikke linjerer i dag:**
1. Venstre starter med `mt-5` (når Aktiviteter er første element rendres `mt-5` mot ingenting, men selve Aktiviteter-headeren har ingen høyde-utligning).
2. Høyre header sitter i en `flex items-center justify-between`-rad der `Ny kontakt`-knappen tvinger rad-høyden opp til ~32px. Venstre header er bare tekst (~18px line-height) → baseline-forskjell på ca. 7–10px.
3. `pt-4 md:pt-0` på høyre er nullstilt på desktop, men venstre har ingen tilsvarende reservert høyde.

## Designvalg

**Tilnærming: standardiser begge kolonneheadre til en felles "kolonne-header-rad" med fast høyde 32px.**

- Begge headere får samme container: `flex items-center justify-between` med `min-height: 32px` og `mb-3`.
- Venstre header (Aktiviteter) får en usynlig høyrejustert "spacer" når den er topp-element, slik at høyden matcher knappen i høyre.
- Faktisk implementasjon: pakk `Aktiviteter · N`-headeren i en flex-rad med samme `min-height: 32px` som høyre. Da linjerer baseline automatisk.
- For høyre: bytt `mb-2` til `mb-3` (matcher venstre) og sett eksplisitt `min-height: 32px` på header-raden så `Ny kontakt`-knappen ikke kan endre høyden.

**Når det IKKE er tasks/Teknisk DNA over** (det vanlige tilfellet i skjermbildet): fjern `mt-5` på `<div>` rundt `CompanyActivityTimeline` slik at Aktiviteter-headeren starter helt på topp av venstre kolonne, og dermed på samme y-posisjon som Kontakter-headeren.

**Når det ER en Oppfølging-blokk eller Teknisk DNA over:** behold den som naturlig flyt over Aktiviteter — da skal Aktiviteter ikke linjeres med Kontakter-headeren (det ville vært visuelt forvirrende). Kontakter står da alene på topp til høyre, og det er greit.

## Plan

1. **`src/components/CompanyCardContent.tsx` linje ~1105:** Endre `<div className="mt-5">` rundt `CompanyActivityTimeline` til betinget margin: kun `mt-5` når `tasks.length > 0` ELLER Teknisk DNA er synlig. Når Aktiviteter er første element → ingen top-margin, så headeren starter på topp.
   ```tsx
   <div className={cn((tasks.length > 0 || showTechDna) && "mt-5")}>
     <CompanyActivityTimeline ... />
   </div>
   ```

2. **`CompanyActivityTimeline` (linje 2169–2173):** Pakk `Aktiviteter · N`-headeren i en flex-rad med `min-height: 32px`, slik at høyden matcher Kontakter-headeren med knapp:
   ```tsx
   <div className="flex items-center mb-3" style={{ minHeight: 32 }}>
     <h3 className="text-[12px] font-medium text-[#5C636E]">
       Aktiviteter · {activities.length}
     </h3>
   </div>
   ```
   Samme behandling i tomtilstand-grenen (linje 2158–2166).

3. **`relatedContactsContent` (linje 1117–1119):** Sett eksplisitt `min-height: 32px` på header-raden og endre `mb-2` til `mb-3` slik at margin matcher venstre:
   ```tsx
   <div className="pt-4 md:pt-0">
     <div className="mb-3 flex items-center justify-between gap-3" style={{ minHeight: 32 }}>
       <h3 className="text-[12px] font-medium text-[#5C636E]">Kontakter · {contacts.length}</h3>
       ...
   ```

## Filer som endres
- `src/components/CompanyCardContent.tsx` — tre små justeringer: betinget `mt-5`, header-wrapper på Aktiviteter (to steder: tom og normal), `min-height` + `mb-3` på Kontakter-header.

## Utenfor scope
- Endring av selve knappen `Ny kontakt` eller dens stil.
- Endring av layout når Oppfølging eller Teknisk DNA er synlig over Aktiviteter (de bevares som i dag).
- Andre flater enn selskapskortet.

