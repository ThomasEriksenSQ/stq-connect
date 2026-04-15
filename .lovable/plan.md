

# Fargeforslag for toggle-tilstander i V8

Alle farger følger V8-paletten med desaturerte 8%-bakgrunner og dempede tekstfarger.

## 1. CV-epost / CV

| Tilstand | Bakgrunn | Tekst | Border |
|----------|----------|-------|--------|
| **Aktiv** | `rgba(26,79,160,0.08)` | `#1A4FA0` | ingen |
| **Inaktiv** | `transparent` | `#8C929C` | `#DDE0E7` |

Blå tone — matcher eksisterende `C.info`-prikken som allerede brukes for CV-epost-indikatoren.

## 2. Innkjøper

| Tilstand | Bakgrunn | Tekst | Border |
|----------|----------|-------|--------|
| **Aktiv** | `rgba(94,106,210,0.08)` | `#5E6AD2` | ingen |
| **Inaktiv** | `transparent` | `#8C929C` | `#DDE0E7` |

Accent/lilla tone — matcher eksisterende `C.accent`-prikken som brukes for innkjøper-indikatoren.

## 3. Ikke relevant person å kontakte igjen

| Tilstand | Bakgrunn | Tekst | Border |
|----------|----------|-------|--------|
| **Aktiv** | `rgba(139,29,32,0.08)` | `#8B1D20` | ingen |
| **Inaktiv** | `transparent` | `#8C929C` | `#DDE0E7` |

Rød/danger tone — signaliserer tydelig negativ status uten å skrike.

## Implementering

Legg til tokens i `src/theme.ts`:

```ts
/* Toggle states */
toggleCv:        { activeBg: "rgba(26,79,160,0.08)",  activeText: "#1A4FA0" },
toggleBuyer:     { activeBg: "rgba(94,106,210,0.08)",  activeText: "#5E6AD2" },
toggleIrrelevant:{ activeBg: "rgba(139,29,32,0.08)",   activeText: "#8B1D20" },
toggleInactive:  { bg: "transparent", text: "#8C929C", border: "#DDE0E7" },
```

Alle inaktive tilstander bruker samme nøytrale stil (grå tekst + subtil border), mens aktive tilstander differensieres med farge.

Oppdater filter-pills i `DesignLabContacts.tsx` FilterRow for TYPE-raden, og `ContactIndicators` for rad-indikatorer.

