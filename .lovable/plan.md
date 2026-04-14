

# Plan: Max-bredde og sentrert innhold for Design Lab på ultrawide

## Problemet

Linear løser ultrawide-skjermer ved å begrense innholdsbredden med en `max-width` (typisk ~1200px) og sentrere innholdet horisontalt. Tabeller strekkes ikke til full skjermbredde. Sidebaren forblir fast til venstre, men hovedinnholdet "flyter" sentrert i midten av det tilgjengelige rommet.

## Løsning

Legg til `max-width: 1100px` på innholds-wrapperen i alle tre Design Lab-sider (Kontakter, Forespørsler, STACQ Prisen). Innholdet sentreres med `margin: 0 auto`.

For Kontakter-siden som har et detaljpanel til høyre, beholdes nåværende layout (ResizablePanelGroup fyller tilgjengelig plass), men tabellinnholdet inne i panelet får max-bredde.

## Tekniske endringer

### 1. `DesignLabStacqPrisen.tsx`
- Wrap chart + tabell-innholdet i en `div` med `maxWidth: 1100px` og `margin: "0 auto"`
- Padding beholdes som nå

### 2. `DesignLabForesporsler.tsx`
- Samme `maxWidth: 1100px` + `margin: "0 auto"` på innholds-wrapperen inne i tabellpanelet

### 3. `DesignLabContacts.tsx`
- Tabellpanelet (venstre del av ResizablePanelGroup) beholder full bredde for å fungere med resize
- Ingen endring her — layouten med detaljpanel håndterer allerede bredden naturlig

### 4. `DesignLabStacqPrisen.tsx` — Tabell forbedring
- Legg til `maxWidth: 1100px` slik at tabellen ikke strekkes uhensiktsmessig bredt
- Chart og stat-linje følger samme max-bredde

