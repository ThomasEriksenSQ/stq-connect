

## Vurdering

Akkurat nå er "AI foreslår"-banneret i Kontaktkortet et alt-eller-ingenting-valg: bruker får én "Legg til teknologier"-knapp som legger til alle foreslåtte tags samlet, eller "Ignorer" som forkaster alle. Det er for grovt — typisk vil AI foreslå f.eks. `Hardware`, `Software`, `RTOS`, `Bluetooth`, og brukeren vil bare ha 2 av 4. I dag må de da legge til alle og slette manuelt etterpå, eller ignorere alt og skrive inn manuelt.

Riktig mønster: hver foreslåtte tag skal være sin egen klikkbare chip. Klikk på en chip → legges til som permanent teknologi-tag og forsvinner fra forslagslista. Når lista er tom (eller bruker klikker "Ignorer alle"), forsvinner banneret.

## Funn

Jeg må først lokalisere AI-forslagsbanneret i `ContactCardContent.tsx`. Basert på skjermbildet vises det rett under teknologi-chipsene, med "AI foreslår:"-tittel, begrunnelse, "Tidsramme", "Teknologier:" rad med chips, og en "+ Legg til teknologier" / "✕ Ignorer"-rad.

Dette ser ut til å være `AiSignalBanner.tsx`-komponenten (i `src/components/`). Må verifisere:
- Hvordan banneret rendres (inline i ContactCardContent vs separat komponent)
- Hvordan "Legg til teknologier" wires opp i dag (callback-prop med array)
- Om samme banner brukes andre steder (ContactDetail V1, evt. i selskapskortet)

## Plan

### 1. Endre interaksjonsmodell i `AiSignalBanner.tsx`
- Hver foreslåtte tag rendres som klikkbar chip (samme V2-stil som dagens "Hardware"/"Software" chips, men med tydelig "klikkbar" affordance — liten `+` ikon eller hover-state).
- Klikk på chip kaller `onAddTag(tag)` (ny single-tag callback) i stedet for `onAddAll(tags[])`.
- Lokal state holder `remainingSuggestions` — chip fjernes fra banneret straks den er lagt til, slik at brukeren får umiddelbar visuell bekreftelse.
- "+ Legg til teknologier" CTA-en fjernes (overflødig når hver chip er klikkbar). "✕ Ignorer" beholdes som "ignorer alle gjenværende".
- Når `remainingSuggestions.length === 0`, kall `onDismiss()` automatisk så banneret forsvinner.

### 2. Oppdater wiring i `ContactCardContent.tsx`
- Erstatt eksisterende `onAddTags(tags: string[])`-callback med `onAddTag(tag: string)` som legger én tag til `tekniske_behov`-array, dedupliserer, og persisterer via samme save-path som manuell tag-tillegging bruker.
- Behold dagens persist-logikk; bare endre granulariteten.

### 3. Visuelt mønster (V2)
- Foreslåtte chips: samme høyde/radius som dagens manuelle teknologi-chips (CHIP_BASE), men med dempet bakgrunn (`C.accentMuted` ~ rgba(94,106,210,0.05)) og liten `+` ikon (Lucide `Plus`, 12px) til venstre for label.
- Hover: `C.accentBg` + cursor pointer.
- Lagt-til-bekreftelse: chip animerer kort ut (fade) eller forsvinner umiddelbart — velger umiddelbart for å holde det enkelt.

### 4. Backwards-kompatibilitet
- Sjekker først om `AiSignalBanner` brukes andre steder. Hvis ja, oppdaterer alle call sites til ny callback-signatur (eller beholder gammel `onAddAll` som valgfri prop for bakoverkompatibilitet).

## Filer som endres
- `src/components/AiSignalBanner.tsx` — endre rendering av teknologi-chips til klikkbare, fjern samle-CTA, legg til lokal state for `remainingSuggestions`.
- `src/components/ContactCardContent.tsx` — bytt callback fra batch (`onAddTags`) til single (`onAddTag`); behold persist-logikk.
- (Potensielt) andre call sites til `AiSignalBanner` — verifiseres før endring og oppdateres tilsvarende.

## Utenfor scope
- Endre AI-prompten eller hvordan teknologier ekstraheres.
- Legge til sletting av allerede-eksisterende teknologi-tags fra banneret (banneret viser kun nye forslag).
- "Legg til alle"-snarvei — kan vurderes senere hvis brukerne savner det, men startes uten for å holde mønsteret rent.
- Tilsvarende endring i selskapskort/forespørsel — kan migreres i en oppfølgende runde hvis samme komponent brukes der.

