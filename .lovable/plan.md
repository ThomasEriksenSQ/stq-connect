

## Vurdering

E-poster i "Aktiviteter" på kontaktkortet kollapser når brukeren prøver å markere tekst inne i selve e-postinnholdet. Dagens `EmailRowBody` wrapper hele raden (inkludert det utvidede e-postinnholdet) i en `role="button"` med toggle-onClick. `useClickWithoutSelection` hjelper for enkle drag-select tilfeller, men feiler ved:

- **Trippelklikk** for å markere et avsnitt — registreres som klikk uten bevegelse, kollapser e-posten.
- **Dobbeltklikk** for å markere ord — kan kollapse på første klikk avhengig av timing.
- **`cursor: pointer`** på hele området — signaliserer "knapp", ikke "tekst", så brukeren tør ikke prøve å markere.
- **Drag-select som starter og slutter nær samme posisjon** (f.eks. liten markering) — havner under terskelen og teller som klikk.

Dette er en strukturell svakhet, ikke et terskelproblem. Riktig grep er å gjøre **kun toppen av e-posten klikkbar for toggle**, og la innholdsområdet være ren tekst.

## Designprinsipp (Gmail/Outlook-mønster)

I etablerte e-postklienter er regelen at **selve e-postinnholdet aldri er klikkbart for å kollapse tråden**. Toggle skjer kun fra header-raden (emne + chevron). Dette er det forventede mønsteret — brukere prøver ikke å klikke i innholdet for å kollapse.

## Plan

### `src/components/ContactCardContent.tsx`

**1. Splitt `EmailRow` i to klikk-soner:**

- **Header-sone (klikkbar toggle):** emne + chevron + avsender→mottaker + dato/badge — beholder `EmailRowBody`-wrapping. Dette er det visuelle "fold-out"-elementet og det eneste som toggle på klikk.
- **Innholds-sone (ren tekst):** `latest`-tekst, "Vis hele tråden"-knapp, og `rest`-tekst når utvidet — flyttes UT av `EmailRowBody`. Ingen `onClick`, ingen `role="button"`, ingen `cursor-pointer`. Kun ren tekst med standard tekstmarkør.

**2. Layout-justering:**

Dagens flex-layout (`flex items-start gap-3`) med dato/badge på høyre side må bevares for header-raden. Det utvidede innholdet plasseres som en separat blokk *under* header-raden, ikke inne i `flex-1`-kolonnen. Dette gir samme visuelle resultat (innhold under emne/avsender) men frigjør tekstområdet fra klikk-soneren.

Strukturen blir:
```
<div className="relative group">
  <Mail-icon spine />
  <EmailRowBody onToggle={toggleExpanded}>
    [emne + chevron]
    [fra → til]
    [preview hvis ikke utvidet]      ← preview kan også være i header-sone (kort, line-clamp-2)
    [dato + E-post badge på høyre]
  </EmailRowBody>
  {expanded && (
    <div className="mt-2 border-t border-border pt-2">
      [latest tekst – ren <p>, ingen klikk]
      [Vis hele tråden-knapp]
      [rest hvis vist]
    </div>
  )}
</div>
```

**3. Cursor-fix på header-sonen:**

Behold `cursor-pointer` på header-sonen (`EmailRowBody`) siden den faktisk ER en toggle. Innholdsområdet får default tekstmarkør (`cursor-text` implisitt).

**4. Behold "Vis hele tråden"-knapp:**

`DesignLabActionButton` med `e.stopPropagation()` er allerede der — flyttingen ut av `EmailRowBody` gjør stopPropagation overflødig, men beholder den for trygghet.

**5. Tastatur-tilgjengelighet:**

`EmailRowBody` har allerede `onKeyDown={activateOnEnterOrSpace}` og `tabIndex={0}` — uendret. Toggle via Enter/Space på header fungerer som før.

## Hvorfor dette er lav-risk

- **Ingen logikkendring:** `setExpanded`, `splitEmailThread`, `showThread` — alt uendret.
- **Ingen DB/state-endring:** kun JSX-strukturell omorganisering.
- **Visuelt identisk:** brukeren ser samme layout, men kan nå markere tekst i innholdet uten at det kollapser.
- **Isolert til én komponent (`EmailRow`):** ingen påvirkning på andre rader, andre kort, eller selskapskortet (selskapskortet har ingen e-postaktiviteter på samme måte — verifisert ved at `EmailRow` kun finnes i `ContactCardContent`).

## Filer som endres

- `src/components/ContactCardContent.tsx` — kun `EmailRow`-komponenten (linje 2590–2666)

## Utenfor scope

- `EmailRowBody`-wrapper (gjenbrukes uendret for header-sonen)
- `useClickWithoutSelection`-hooken (uendret — fortsatt riktig for header-toggle)
- Selskapskortet, aktivitetsrader, oppfølginger
- Andre sheets (Oppdrag, Forespørsel, Ansatt)

