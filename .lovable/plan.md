

## Funn

I bildet ser jeg footer-området i Design Lab-sidebaren: tekststørrelse-velger (S/M/L/XL/XXL), "Innstillinger", "Logg ut", og helt nederst-til-høyre en liten **collapse-knapp** (PanelLeftClose-ikon) som flyter alene i en rad. Den ser løsrevet og uklar ut — brukeren vet ikke umiddelbart hva den gjør, og den bryter den ellers stramme Linear-estetikken.

I `src/components/designlab/DesignLabSidebar.tsx` rendres den i dag i en egen `<div>` under "Logg ut" med `justify-end` (linje 124–128 for expanded modus). I collapsed modus rendres den som en full rad under footeren (linje 130–134).

## Vurdering av alternativer

| Alternativ | Vurdering |
|---|---|
| **A. Flytt til toppen ved logoen** | Linear, Notion, Height og Linear-klonene plasserer alle collapse-knappen ved siden av logoen øverst — ofte synlig kun on-hover. Dette er det mest etablerte mønsteret og frigjør footeren helt. |
| **B. Behold i footer, men integrer som "stille" hover-action** | Vis kun on-hover, helt nede i hjørnet. Mindre oppdagbart, men ryddigere. |
| **C. Fjern knappen helt — kun ⌘\ shortcut** | For minimalistisk; nye brukere finner den ikke. |
| **D. Slå sammen med tekststørrelse-raden** | Blander to ulike kontroller (visning vs. layout) — semantisk rotete. |

**Anbefaling: Alternativ A** — flytt collapse-toggle til logo-raden øverst. Dette er Linear-standarden, frigjør footeren, og gir naturlig oppdagbarhet (knappen sitter ved appens identitet, ikke som en rar fotnote).

## Plan

### Endring i `src/components/designlab/DesignLabSidebar.tsx`

**1. Logo-raden (ca. linje 71–95)**
- Endre logo-containeren fra `justify-content: flex-start/center` til en flex-rad med logo til venstre og collapse-toggle til høyre (kun i expanded modus).
- I collapsed modus: logoen blir klikkbar/hover-bar og toggler ekspansjon (eller behold en mini-knapp under logoen).

Layout expanded:
```
[STACQ-logo ─────────────────── ⟨ ]
```

Layout collapsed:
```
[ S ]
[ ⟩ ]   ← liten toggle rett under logo, midtstilt
```

**2. Footer (ca. linje 119–137)**
- Fjern collapse-toggle fra footer helt.
- Footer reduseres til:
  ```
  ─────────────────
  ⚙  Innstillinger
  ↪  Logg ut
  ```
- Behold tekststørrelse-raden over footer-streken som i dag.

**3. Behold ⌘\ shortcut**
Ingen endring i keyboard-handler — fungerer som før.

**4. Tooltip og a11y**
Behold `title` og `aria-label` ("Skjul sidebar (⌘\\)" / "Utvid sidebar (⌘\\)").

### Visuell finpuss
- I expanded: collapse-knappen er `C.textGhost` som standard, blir `C.textMuted` on hover — ingen bakgrunn med mindre hover, da `C.hoverSubtle`. Holder den "stille" ved siden av logoen.
- Størrelse: 14px ikon, 24×24px treffareal — samme som i dag.

### Resultat
Footeren blir ren og funksjonell (kun innstillinger + logout). Collapse-kontrollen lever der den hører hjemme — ved appens identitet — og følger Linear-konvensjonen brukere allerede kjenner.

## Utenfor scope
- Ingen endring i V1 (`AppSidebar.tsx`).
- Ingen endring i ⌘\-shortcut eller `usePersistentState`.
- Ingen endring i tekststørrelse-velgeren.

