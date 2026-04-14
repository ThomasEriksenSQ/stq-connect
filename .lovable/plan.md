

# Plan: Design Lab V7 — "Sophisticated Simplicity"

## Hva som endres fra V6

V6 er et godt fundament men mangler den siste finishen. Her er de konkrete endringene:

### 1. Visuell oppgradering — mer sofistikert

- **Bordere**: Bytt fra `#E8E8E8` til `rgba(0,0,0,0.06)` — subtilere, mer "pixel-perfekt" preg. Radskiller i tabellen blir `rgba(0,0,0,0.04)` — nesten usynlige, men der.
- **Bakgrunn**: Hvit `#FFFFFF` med `#FAFAFA` kun på header-raden i tabellen.
- **Typografi**: Stram opp font-weights — headers 11px/500 (ikke 600), data 13px/400, navn 13px/500. Mindre "bold", mer elegant.
- **Spacing**: Øk horisontal padding i celler fra px-2 til px-3. Mer luft = mer premium.
- **Hover**: Rader får `rgba(0,0,0,0.015)` — knapt synlig, men nok til å gi feedback.
- **Fokusert rad**: Venstre 2px blå stripe erstattes med subtil `rgba(0,0,0,0.03)` bakgrunn + tynn venstrekant.

### 2. Tabellkolonner — eksakt som dagens kontaktliste

Matcher kolonnene fra `Contacts.tsx`:

| Kolonne | Beskrivelse |
|---------|-------------|
| **Navn** | Fullt navn, sortbart |
| **Signal** | Badge med dropdown-redigering (Behov nå, Fremtidig behov, etc.) |
| **Finn** | Radio-ikon hvis markedsradar-treff |
| **Selskap** | Selskapsnavn |
| **Stilling** | Tittel |
| **Tags** | CV/Innkjøper-badges |
| **Siste akt.** | Relativ tid |

Pluss checkbox-kolonne for bulk-actions (nytt i design lab, men naturlig utvidelse).

Konsulentvelger-seksjonen over tabellen med "Tilgjengelig for oppdrag"-pills beholdes som mockdata.

Filter-rader (Eier, Signal, Type) beholdes i ny stil.

### 3. Kontaktperson-side — egen side, ikke overlay

`DesignLabContactDetail.tsx` blir en full side (ikke redirect) med ny TopNav + tilbake-navigasjon. Innholdet speiler alle elementer fra `ContactCardContent.tsx`:

- **Header**: Navn, eier-badge, signal-badge med dropdown
- **Metadata**: Selskap (klikkbar), sted, avdeling, stilling
- **Kontaktinfo**: Telefon, e-post, LinkedIn som pills
- **Status-toggles**: CV-Epost, Innkjøper, Ikke relevant
- **Teknisk DNA**: Tags med "Finn konsulent"-knapp
- **Notat**: Redigerbart tekstfelt
- **Action buttons**: Logg samtale, Logg møtereferat, Ny oppfølging
- **Oppfølginger**: Liste med status, dato, inline-redigering
- **Aktiviteter**: Tidslinje gruppert per måned med ikoner
- **Konsulentmatch**: Resultatliste med score og tags

Alt med mockdata men samme struktur og felter.

### 4. Design-tokens (nye, skarpere verdier)

```text
Border:           rgba(0,0,0,0.06)    -- hovedgrenser
Border subtle:    rgba(0,0,0,0.04)    -- radskillere
Hover row:        rgba(0,0,0,0.015)
Selected row:     rgba(0,0,0,0.03)
Header bg:        #FAFAFA
Text primary:     #111827
Text secondary:   #6B7280
Text tertiary:    #9CA3AF
Button primary:   #111827 bg, white text
Font sizes:       11px headers, 13px data, 20px page title
Row height:       44px
```

## Filer som endres

1. **`src/pages/DesignLabContacts.tsx`** — Omskrives: tabellkolonner matcher dagens CRM, visuelt system oppgradert med subtilere bordere og spacing. Konsulentvelger + filter-rader inkludert som mockdata.

2. **`src/pages/DesignLabContactDetail.tsx`** — Omskrives til full side (ikke redirect): TopNav, tilbake-knapp, og alle elementer fra ContactCardContent reprodusert med mockdata i nytt design.

3. **`src/App.tsx`** — Ingen endring (rutene eksisterer allerede).

## Ikke berort
- Ingen endring i eksisterende CRM-kode
- Alt mockdata, ingen database
- Kun design-lab-sider

