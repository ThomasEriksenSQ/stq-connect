

## Funn

I `OppdragEditSheet.tsx` finnes STATUS-blokken (Aktiv / Oppstart / Inaktiv chips) som vises både ved "Nytt oppdrag" og redigering. Etter forrige iterasjon derives status nå automatisk fra start- og sluttdato i `buildOppdragWritePayload`, så disse chipsene har ingen reell effekt — de er misvisende.

## Plan

### Endring i `src/components/OppdragEditSheet.tsx`

**1. Fjern STATUS-blokken (label + tre chips Aktiv/Oppstart/Inaktiv)**
- Fjern hele seksjonen rundt linje 569–587.
- Behold `status`-state i form-objektet (initialiseres fra eksisterende rad ved redigering, default `"Oppstart"` for nye). Dette beholdes fordi `computeOppdragStatus` respekterer eksplisitt `"Inaktiv"` som hard avslutning satt via "Avslutt oppdrag"-knappen.

**2. Fjern eventuell hint-tekst om "Status settes automatisk"**
Hvis lagt til i forrige iterasjon under status-chipsene — fjernes sammen med blokken.

**3. Behold "Avslutt oppdrag"-knappen**
Den dekker fortsatt manuell `Inaktiv`-overstyring (setter `slutt_dato = i dag` + `status = "Inaktiv"`).

### Resultat
"Nytt oppdrag" og "Rediger oppdrag" viser kun input-felter som faktisk påvirker noe. Status er en transparent konsekvens av start/slutt-datoer.

## Utenfor scope
- Ingen endring i `buildOppdragWritePayload` eller `computeOppdragStatus`.
- Ingen endring i listevisningen eller "Avslutt oppdrag"-flyten.
- Ingen endring i V1-flater.

