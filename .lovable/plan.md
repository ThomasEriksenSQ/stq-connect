

## Plan: Slå sammen AI-signalbannere til én samlet analyse

### Problem
To separate bannere (AI foreslår + E-post-puls) gir ofte samme anbefaling og skaper visuell støy. Begge koster et AI-kall hver.

### Løsning
Slå sammen til **ett banner** som kombinerer begge datakildene i én analyse. Kall det fortsatt "AI foreslår" med Sparkles-ikon, men send **både aktiviteter OG e-poster** i samme prompt. Resultatet inkluderer signal, begrunnelse, teknologier og tidsramme — alt i én visning.

### Tekniske endringer

**1. `src/lib/aiSignal.ts` — utvid input og prompt**
- Legg til valgfrie felter: `emails`, `currentTechnologies`
- Utvid system-prompt til å analysere både aktiviteter og e-poster
- Returner utvidet resultat: `teknologier_funnet` og `tidsramme` (som i E-post-puls)
- Trunkerer e-poster til 500 tegn × 5 stk, samme som i dag

**2. `src/components/AiSignalBanner.tsx` — utvid UI**
- Hent e-poster via `useQuery(["email-puls-emails", contactEmail])` (gjenbruk cache)
- Send e-poster + teknologier inn til `analyzeSignal()`
- Vis teknologier og tidsramme i banneret (som E-post-puls gjør i dag)
- Legg til "Legg til teknologier"-knapp
- Nye props: `contactEmail`, `currentTechnologies`, `onAddTechnologies`

**3. Slett `src/components/EmailPulsBanner.tsx` og `src/lib/aiEmailPuls.ts`**
- Ikke lenger nødvendig

**4. `src/components/ContactCardContent.tsx` — fjern EmailPulsBanner**
- Fjern import og bruk av `EmailPulsBanner`
- Send nye props til `AiSignalBanner`: `contactEmail`, `currentTechnologies`, `onAddTechnologies`

### Resultat
- Ett AI-kall i stedet for to → halverer token-bruk
- Én samlet begrunnelse som veier aktiviteter mot e-poster
- Teknologier og tidsramme vises fortsatt
- Renere UI med ett banner i stedet for to

### Filer
| Fil | Endring |
|-----|---------|
| `src/lib/aiSignal.ts` | Utvid med e-poster og teknologier |
| `src/components/AiSignalBanner.tsx` | Utvid med teknologier/tidsramme/e-poster |
| `src/components/ContactCardContent.tsx` | Fjern EmailPulsBanner, send nye props |
| `src/lib/aiEmailPuls.ts` | Slett |
| `src/components/EmailPulsBanner.tsx` | Slett |

