

## Plan: Fjern kompetanse-seksjonen fra redigeringsmodus

### Problem
Kompetanse-feltet i redigeringsmodus kan ikke redigeres når det er CV-styrt, og tar unødvendig plass.

### Endring i `src/components/AnsattDetailSheet.tsx`

Wrap hele kompetanse-blokken (linje 517–598) i en `{!kompetanseStyresAvCv && (...)}` betingelse, slik at den kun vises når kompetansen **ikke** er CV-styrt (dvs. kun for nye ansatte eller ansatte uten CV-profil). Når CV styrer kompetansen, fjernes seksjonen helt fra redigeringsvisningen — brukeren ser den allerede i visningsmodusen med "Vis mer"-funksjonalitet.

### Kun én fil endres
- `src/components/AnsattDetailSheet.tsx` (linje 517–598)

