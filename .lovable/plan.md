

# Plan: Fiks layout-forskyving og default-skjuling i 3-prikker-menyen

## Problem
1. Når man åpner 3-prikker-menyen forskyves layouten — trolig fordi DropdownMenu endrer scroll/layout
2. Avdeling vises selv når feltet er tomt (f.eks. "Avdeling" placeholder)
3. Steder som ikke er valgt (f.eks. "LILLESTRØM") vises selv om ingen er valgt

## Endringer i `src/components/ContactCardContent.tsx`

### 1. Fiks layout-forskyving
- Legg til `modal={false}` på `DropdownMenu` for 3-prikker-menyen (linje ~804), slik at den ikke skaper en overlay som påvirker scroll-posisjon
- Legg til `sideOffset={4}` på `DropdownMenuContent` for å unngå at menyen dytter innhold

### 2. Skjul avdeling når tom (defaultHidden aktiv)
Linje ~922: Legg til betingelse slik at avdeling skjules når `defaultHidden` er satt og `(contact as any).department` er tomt/null:
```ts
{showAvdeling && !(defaultHidden && !(contact as any).department) && (
```

### 3. Skjul steder med ingen valgte (allerede fungerer?)
Sjekke at linje 884 faktisk fanger opp korrekt — "LILLESTRØM" som ikke er valgt betyr `contactLocations.length === 0`, som allerede bør trigge skjuling. Men fra skjermbildet ser det ut som unselected locations likevel vises. Problemet er at `companyLocations` vises uansett — vi må skjule hele blokken når ingen er valgt og `defaultHidden` er aktiv (dette ser ut til å allerede være implementert på linje 884, men vi verifiserer og evt. fikser).

## Filer som endres
- `src/components/ContactCardContent.tsx` — 3 små endringer

