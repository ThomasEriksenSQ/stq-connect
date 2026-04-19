

## Vurdering

Nei — de er **ikke like**. Det er to ulike avvik:

### Funn

**Selskapsnavn i tabellen** (`DesignLabCompanies.tsx` linje ~511):
- `fontSize: 13px`
- `fontWeight: 500`
- `color: #1A1C1F` (C.text)
- font-family: Inter (arvet fra app-root)

**"Kontakter" i selskapskortet** (`CompanyCardContent.tsx` linje 1119, etter siste endring):
- `text-[13px]` ✅
- `font-medium` (500) ✅
- `text-[#1A1C1F]` ✅
- font-family: Inter ✅

På papiret er de identiske. **Men** — i bildene ser "Kontakter" tydelig **tyngre/fetere** ut enn "1X Technologies AS". Hvorfor?

### Sannsynlig årsak

Brukeren er på `/design-lab/selskaper` med selskapskort åpent. Tekstskaleringen (`dl-text-size`-pillene i sidebaren) bruker CSS `zoom` på `<main>`-elementet. Hvis kortet og tabellen rendres innenfor samme `<main>` er skaleringen lik — men hvis selskapskortet er en `Sheet`/overlay som rendres utenfor `<main>` (via Radix portal til `<body>`), så får **ikke** kortet samme zoom som tabellen. Da kan tabellen være zoomet ned (f.eks. til "S" = 0.85) mens kortet rendres på 100%, og resultatet er at "Kontakter" leses som større/fetere selv om CSS-verdiene er identiske.

Sekundær mulighet: `font-medium` i Tailwind = 500, men hvis tabellraden bruker inline `style={{ fontWeight: 500 }}` og kortet bruker Tailwind-klasse, er begge 500 — så vekt er ikke forskjellen. Det er **rendret pikselstørrelse** som skiller dem, og det peker på zoom/portal-mismatch.

### Plan for verifikasjon (ingen kodeendringer ennå)

1. **Bekreft hvor selskapskortet rendres**: les `DesignLabCompanies.tsx` rundt der `CompanyCardContent` mountes for å se om det er inni en `Sheet`/`Dialog` (portal til body) eller inline i `<main>`.
2. **Bekreft hvor tekstskalering anvendes**: les `DesignLabPageShell.tsx` for å se hvilken DOM-node som får `zoom`/`fontSize`-skalering.
3. **Konkluder**: 
   - Hvis kortet er i portal → fix: anvend samme skalering på Sheet-content (eller flytt skalering til `<html>`/`<body>` så portaler arver).
   - Hvis kortet er inline → typografien skal være pixel-identisk, og avviket er kun visuell illusjon (omkringliggende tekstmasse påvirker oppfattet vekt). Da er ingen endring nødvendig.

### Filer som leses
- `src/pages/DesignLabCompanies.tsx` (mount-stedet for kortet)
- `src/components/designlab/DesignLabPageShell.tsx` (zoom-anvendelse)
- `src/components/designlab/TextSizeControl.tsx` (skalerings-target)

### Filer som potensielt endres (avhenger av funn)
- `src/components/designlab/DesignLabPageShell.tsx` eller `TextSizeControl.tsx` — flytt zoom-target slik at portaler også skaleres.

### Utenfor scope
- Endring av selve typografiverdiene — de er allerede korrekt linjert (13px / 500 / #1A1C1F).

