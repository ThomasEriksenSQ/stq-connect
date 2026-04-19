

## Vurdering

I "Ny oppfølging"-skjemaet inne i `ContactCardContent` kan brukeren i dag trykke "Lagre oppfølging" så lenge tittel og kategori er fylt ut — "Når?" (dato) er ikke validert. Dette skaper oppfølginger uten forfallsdato ved et uhell, noe som forurenser dashbordet.

Regelen skal være: alle tre felter (tittel, kategori, når) må være satt før knappen er aktiv.

Merk: "Følg opp på sikt" (someday) er en legitim variant der `due_date` er null. Hvis skjemaet har en eksplisitt "På sikt"-chip blant dato-valgene, teller den som gyldig "Når?"-valg. Hvis ikke, må bruker velge en konkret dato eller en preset-chip.

## Funn jeg må gjøre først

Lese `ContactCardContent.tsx` for å finne:
- `activeForm`-grenen som rendrer "Ny oppfølging"-skjemaet
- Nåværende `disabled`-betingelse på "Lagre oppfølging"-knappen
- Hvilken state som holder "Når?"-valget (date chip eller custom date)
- Om "På sikt" finnes som valg

## Plan

### `src/components/ContactCardContent.tsx`

I "Ny oppfølging"-skjemaet:
1. Identifiser state for valgt dato/dato-chip (sannsynligvis `selectedDate` + `customDate`, parallelt med `FollowUpModal`-mønsteret).
2. Definer `hasWhen` = sant hvis en dato-chip er valgt ELLER custom-dato er satt ELLER "På sikt" er valgt (hvis den finnes).
3. Oppdater `disabled`-prop på "Lagre oppfølging"-knappen til å kreve `title.trim() && category && hasWhen`.
4. Behold visuell disabled-stil som allerede brukes for andre disabled-knapper i V2 (dempet bakgrunn, `cursor-not-allowed`).

Ingen endring i submit-handler, persist-logikk eller default-verdier — kun strammere validering.

## Filer som endres
- `src/components/ContactCardContent.tsx`

## Utenfor scope
- `FollowUpModal` (separat komponent, har allerede egen validering)
- Endring av default-dato per signal
- Visuell omdesign av skjemaet

