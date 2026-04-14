

# Plan: Legg til Type-filtre i Design Lab filterrad

## Hva skal gjøres

Utvide filterraden i Design Lab med en tredje filtergruppe **"Type"** med pillene: **Alle**, **Innkjøper**, **CV-Epost**, **Ikke relevant kontakt** — matchende referansebildet. Samtidig endre filterraden fra dropdown-stil til den horisontale pill-baserte layouten vist i skjermbildet, der alle alternativer er synlige som klikkbare pills med label til venstre.

## Visuell stil (Linear-konsistent)

Filterraden får en layout per rad:
```text
EIER      [Alle] [Jon Richard Nygaard] [Thomas Eriksen] [Uten eier]
SIGNAL    [Alle] [Behov nå] [Får fremtidig behov] [Får kanskje behov] [Ukjent om behov] [Ikke aktuelt]    {count} kontakter
TYPE      [Alle] [Innkjøper] [CV-Epost] [Ikke relevant kontakt]
```

- Label: uppercase, 11px, fontWeight 600, color `C.textMuted`, tracking 0.06em
- Pill uvalgt: rounded-full, border `C.border`, color `C.textMuted`, 13px
- Pill valgt: bg `C.accent`, color white, no border
- Kontakttelling høyrejustert på signal-raden
- Søkefelt flyttes over filterradene (allerede i header)

## Tekniske endringer

### `src/pages/DesignLabContacts.tsx`

1. **Ny state**: `typeFilter` med verdier `"Alle" | "Innkjøper" | "CV-Epost" | "Ikke relevant kontakt"`
2. **Ny state**: `ownerFilter` utvides med `"Uten eier"` som alternativ
3. **Erstatte FilterPill-dropdown** med en ny `FilterRow`-komponent som renderer alle alternativer som horisontale pills
4. **Filtrering**: Utvide `filtered` useMemo med typeFilter-logikk:
   - "Innkjøper": `c.callList === true`
   - "CV-Epost": `c.cvEmail === true`
   - "Ikke relevant kontakt": fjerne `ikke_aktuell_kontakt`-filteret fra queryen og filtrere klientside
5. **Fjerne `ikke_aktuell_kontakt`-filter** fra Supabase-queryen slik at "Ikke relevant kontakt" kan vises
6. **Layout**: Filterraden utvides til 3 rader med vertikal spacing, ca 120px høyde totalt
7. **Nullstill-knapp**: oppdateres til å også nullstille typeFilter

