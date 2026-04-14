

# Plan: Linear-strategi for ultrawide — faste kolonnebredder + fleksibel navnekolonne

## Hva endres

Fjern `maxWidth: 1100px` fra Forespørsler og STACQ Prisen. Erstatt med Linears faktiske strategi: alle kolonner unntatt den primære (navn/selskap) har **faste pikselbredder**. Den primære kolonnen bruker `minmax(0, 1fr)` og absorberer all tilgjengelig plass. På ultrawide strekkes bare navnekolonnen — resten holder seg kompakt.

## Strategi per side

### Kontakter (DesignLabContacts.tsx)
Allerede bra — bruker `minmax(0,2fr)` på Navn som fleksibel kolonne. Juster til `minmax(0,1fr)` og gi de øvrige kolonnene faste bredder:

**Full tabell (uten detaljpanel):**
| Kolonne | Bredde |
|---------|--------|
| Navn | `minmax(0, 1fr)` — fleksibel |
| Signal | `120px` |
| Selskap | `200px` |
| Stilling | `180px` |
| Eier | `160px` |
| Siste | `64px` |

**Kompakt tabell (med detaljpanel):**
| Kolonne | Bredde |
|---------|--------|
| Navn | `minmax(0, 1fr)` |
| Signal | `100px` |
| Selskap | `160px` |
| Siste | `56px` |

### Forespørsler (DesignLabForesporsler.tsx)
Fjern `maxWidth: 1100px`. Bruk faste kolonnebredder:

**Full tabell:**
| Kolonne | Bredde |
|---------|--------|
| Mottatt | `80px` |
| Selskap | `minmax(0, 1fr)` — fleksibel |
| Kontakt | `180px` |
| Type | `70px` |
| Teknologier | `200px` |
| Pipeline | `140px` |

**Kompakt (med detaljpanel):**
| Kolonne | Bredde |
|---------|--------|
| Mottatt | `80px` |
| Selskap | `minmax(0, 1fr)` |
| Kontakt | `140px` |
| Type | `56px` |

### STACQ Prisen (DesignLabStacqPrisen.tsx)
Fjern `maxWidth: 1100px`. Chart beholder max-bredde (det er innhold, ikke tabell). Tabellen bruker faste kolonnebredder:

| Kolonne | Bredde |
|---------|--------|
| Konsulent | `minmax(0, 1fr)` — fleksibel |
| Kunde | `200px` |
| Type | `80px` |
| Utpris | `80px` |
| Ekstra | `80px` |
| STACQ Pris | `100px` |
| % | `56px` |
| Status | `80px` |

Chart-containeren beholder `maxWidth: 900px` for lesbarhet (Linear gjør dette for innholdsblokker).

## Tekniske endringer

### 1. `DesignLabContacts.tsx`
- Endre `gridTemplateColumns` i full- og kompakt-modus til faste px + `minmax(0,1fr)` for navnekolonnen
- 4 steder: header + rader × 2 varianter

### 2. `DesignLabForesporsler.tsx`
- Fjern `maxWidth: 1100, margin: "0 auto"` fra wrapperen
- Endre `gridTemplateColumns` i `TableHeader` og `ForespRow` til faste px + `minmax(0,1fr)` for selskapskolonnen

### 3. `DesignLabStacqPrisen.tsx`
- Fjern `maxWidth: 1100, margin: "0 auto"` wrapperen
- Endre `gridTemplateColumns` i header, rader og total-rad til faste px + `minmax(0,1fr)` for konsulentkolonnen
- Behold `maxWidth: 900px` kun på chart-blokken

