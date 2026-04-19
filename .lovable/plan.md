

## Mål
På Oppfølginger-siden skal **Eier-filteret** som standard være satt til den innloggede brukeren (i stedet for "Alle"), slik at man umiddelbart ser sine egne oppfølginger.

## Funn
Tre flater viser oppfølginger:
| Flate | Default i dag | Endring? |
|---|---|---|
| `src/components/dashboard/OppfolgingerSection.tsx` (Dashboard-tab) | `user?.id \|\| "all"` ✓ allerede korrekt | Nei |
| `src/pages/Tasks.tsx` (V1 `/oppfolginger`) | `"all"` | Ja |
| `src/pages/DesignLabOppfolginger.tsx` (V2 `/design-lab/oppfolginger`) | `"Alle"` | Ja |

På opprettelse er `assigned_to: user?.id` allerede satt riktig overalt.

## Endringer

### 1. `src/pages/Tasks.tsx`
- Hent `currentUserProfile` fra `profiles`-listen ved hjelp av `user?.id` (samme mønster som `OppfolgingerSection`).
- Endre `useState("all")` for `ownerFilter` til å initialiseres tomt og settes via en `useEffect` når `user?.id` er tilgjengelig — alternativt en `useMemo`/inline default som faller tilbake til `"all"` hvis bruker ikke er innlogget enda.
- Sikre at `Eier`-filterets `SelectValue` viser den innloggede brukerens fornavn som default.

### 2. `src/pages/DesignLabOppfolginger.tsx`
- Endre `useState("Alle")` for `ownerFilter` slik at den initialiseres til den innloggede brukerens fulle navn (`profiles.find(p => p.id === user?.id)?.full_name`) når data er lastet.
- Bruk samme `useEffect`-mønster: når `user?.id` og `profiles` er klare og `ownerFilter` fortsatt er "Alle" (uberørt), sett den til brukerens navn.
- Behold "Alle" / "Uten eier" som valgbare alternativer i filteret — kun standardvalget endres.

## Effekt
Når Jon Richard eller Thomas åpner Oppfølginger-siden (både V1 og V2), ser de først sine egne oppfølginger. De kan fortsatt bytte til "Alle" eller en annen kollega via filteret.

## Utenfor scope
- Ingen endring i `OppfolgingerSection.tsx` (allerede korrekt).
- Ingen endring i opprettelsesflyten — `assigned_to` settes allerede til innlogget bruker.
- Ingen endring i sortering, kolonner eller andre filtre.
