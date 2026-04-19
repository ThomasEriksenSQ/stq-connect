

## Vurdering

Ja — det er bedre design. Akkurat nå er det **brudd på visuell rytme** mellom selskapskortet og listen bak: når du lukker panelet ser du selskapsnavn i 13px / 500 / mørk (#1A1C1F), når du åpner det ser du «Kontakter · N» i 12px / 500 / dempet grå (#5C636E). Begge er primære "innganger" til innhold på samme nivå, men de leses med ulik vekt. I Linear/V8-systemet skal hierarki bygges på **én skala** (13px standard) der det som er handlekraftig innhold står i `C.text`, og kun ekte sekundærtekst dempes.

Konsekvensen blir også at "Aktiviteter · N" må følge med — ellers får vi to kolonneheadere som leser ulikt mot hverandre, og det er nettopp det vi nettopp ryddet opp i (samme baseline-linje).

## Mål
Løfte kolonneheaderne **Aktiviteter · N** og **Kontakter · N** i selskapskortet til samme typografi som selskapsnavn i tabellen, slik at de leses som "primære innganger" — ikke som dempede labels.

## Funn
- Selskapsnavn i tabell (`DesignLabCompanies.tsx` linje 511):
  `fontSize: 13, fontWeight: 500, color: C.text` (#1A1C1F)
- Kontakter-header (`CompanyCardContent.tsx` linje 1119):
  `text-[12px] font-medium text-[#5C636E]`
- Aktiviteter-header (linjer 2162 og 2174): identisk med Kontakter.
- Tellet «· N» er metadata, ikke del av tittelen.

## Designvalg

**Tittel-del**: 13px / vekt 500 / `C.text` (#1A1C1F) — match tabellen 1:1.

**Telle-del** («· N»): behold dempet for å bevare hierarki innenfor selve headeren — `C.textFaint` (#8C929C), vekt 400, samme 13px. Skiller signal (tittel) fra støy (antall) uten å bytte fontstørrelse — ren Linear-tilnærming.

**Hvorfor ikke gjøre hele headeren dempet i 13px?** Da mister vi vektkontrasten mot listeradene under (kontaktnavn / aktivitet-titler) som også er ~13px. Tittel i `C.text` + telle i `C.textFaint` gir to lesenivåer på én linje uten ny fontskala.

**Hvorfor ikke 13px / 600?** 600 finnes i V2-skalaen, men reserveres til sidetitler (18–20px). 500 er standard for primær UI-tekst — og tabellen bruker 500. Konsistens vinner.

**Min-height 32px og `mb-3` beholdes** — baseline-aligneringen vi nettopp etablerte må ikke brytes.

## Plan

1. **`src/components/CompanyCardContent.tsx` — Kontakter-header (linje 1119)**:
   ```tsx
   <h3 className="text-[13px] font-medium text-[#1A1C1F]">
     Kontakter <span className="font-normal text-[#8C929C]">· {contacts.length}</span>
   </h3>
   ```

2. **`src/components/CompanyCardContent.tsx` — Aktiviteter-header (linjer 2162 og 2174, begge grener)**:
   ```tsx
   <h3 className="text-[13px] font-medium text-[#1A1C1F]">
     Aktiviteter <span className="font-normal text-[#8C929C]">· {activities.length}</span>
   </h3>
   ```
   Tilsvarende for tom-tilstanden (linje 2163: `· 0`).

3. **Ingen øvrige endringer**: spacing, min-height, knapper, og avstand til streken over forblir uendret.

## Filer som endres
- `src/components/CompanyCardContent.tsx` — tre `<h3>`-erstatninger.

## Utenfor scope
- Andre seksjonsoverskrifter i selskapskortet (f.eks. «Notater», «Teknisk DNA», «Oppfølginger») — kan vurderes i en oppfølgende runde for full konsistens, men endres ikke nå for å holde scope tett.
- Kontaktdetaljsiden eller andre flater.
- Tabellradenes typografi (de er allerede fasit).

