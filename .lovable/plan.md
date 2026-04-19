

## Funn

Bildet viser e-postraden nederst i venstremenyen i Design Lab — en pille med initialer (TH) + `thomas@stacq...` + collapse-knapp.

I `src/components/designlab/DesignLabSidebar.tsx` (linje 139–150) rendres dette som en egen rad under "Innstillinger" og "Logg ut". Den viser:
- Initialer-avatar (TH)
- E-postadresse (truncated)
- Collapse-toggle (⌘\)

## Vurdering

E-posten er overflødig fordi:
- Det er kun 2 brukere i systemet (Jon Richard og Thomas) — de vet hvem de er logget inn som
- "Logg ut" rett over gir allerede kontotilknytning
- Tar opp en hel rad nederst uten å gi reell verdi
- Initialer-pillen duplikerer info

Collapse-toggle (⌘\) må derimot beholdes — den er den eneste UI-måten å skjule sidebaren på.

## Plan

Fjern hele e-post/avatar-raden i footer i `DesignLabSidebar.tsx`. Behold collapse-toggle ved å flytte den til en enkel rad nederst (samme som dagens `!user`-variant — høyrejustert toggle).

### Endringer i `src/components/designlab/DesignLabSidebar.tsx`

1. Fjern `user`-blokken (linje 139–150) som rendrer avatar + e-post + toggle.
2. Fjern `!user`-blokken (linje 152–156) — blir overflødig.
3. Erstatt med én enkel rad som alltid viser collapse-toggle høyrejustert når sidebaren er utvidet.
4. Behold `collapsed`-blokken (linje 158–162) uendret — full-row toggle når sidebar er kollapset.
5. Fjern `User`-import fra `@supabase/supabase-js` og `initials`-variabelen hvis ingen andre bruker dem (sjekk: `user`-prop blir fortsatt mottatt for fremtidig bruk, men kan også fjernes fra props hvis ren opprydding ønskes — anbefaler å beholde prop-signaturen for å unngå ringvirkninger på `DesignLabPageShell`).

### Resultat

Footer blir:
```
─────────────────
⚙  Innstillinger
↪  Logg ut
                ⟨  ← collapse-toggle høyrejustert
```

Renere, mer i tråd med Linear-estetikken (kontrollert tetthet), og fjerner duplikat-info.

## Utenfor scope

- Ingen endringer i `AppSidebar.tsx` (V1).
- Ingen endring av `signOut`-flyt eller auth-logikk.

