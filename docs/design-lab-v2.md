# Design Lab V2

`design-lab` skal vise de faktiske V2-komponentene og sidene, ikke en separat CSS-demo.

## Kortversjon

- Bruk ekte V2-komponenter som sannhet.
- Behandle `design-lab/...` som preview av ekte komponenter og ekte sideoppsett.
- Ikke løs UI i `src/index.css` eller andre globale snarveier hvis det egentlig hører hjemme i komponentene.
- Legg generelle UI-regler i `src/components/designlab/system/*` eller `src/components/designlab/controls.tsx`.
- Hold page-spesifikke overrides til et minimum.

## Sannhetskilder

Se disse i denne rekkefølgen når du er i tvil:

1. `src/components/designlab/system/*`
2. `src/components/designlab/controls.tsx`
3. `src/pages/DesignLabStyleguide.tsx`
4. relevante `src/pages/DesignLab*.tsx`-sider
5. `src/components/designlab/DesignLabSidebar.tsx` for shell og navigasjon

Hvis noe spriker, vinner komponentene og de faktiske `DesignLab*`-sidene over global CSS.

## Referansesider

- `src/pages/DesignLabStyleguide.tsx`
- `src/pages/DesignLabContacts.tsx`
- `src/pages/DesignLabCompanies.tsx`
- `src/pages/DesignLabForesporsler.tsx`
- `src/pages/DesignLabStacqPrisen.tsx`

- Tokens: `src/theme.ts`
- Primitives: `src/components/designlab/controls.tsx`
- Semantisk V2-lag: `src/components/designlab/system/*`
- Levende visning: `src/pages/DesignLabStyleguide.tsx`

## Delte V2-komponenter

### Actions

- `DesignLabPrimaryAction`
- `DesignLabSecondaryAction`
- `DesignLabGhostAction`
- `DesignLabInlineTextAction`
- `DesignLabInlineActions`

### Chips og badges

- `DesignLabToggleChip`
- `DesignLabReadonlyChip`
- `DesignLabMatchFilterChip`
- `DesignLabFilterRow`
- `DesignLabChipGroup`
- `DesignLabStatusBadge`
- `DesignLabCategoryBadge`
- `DesignLabSignalBadge`

### Fields og modaler

- `DesignLabTextField`
- `DesignLabFieldLabel`
- `DesignLabFieldGrid`
- `DesignLabModalContent`
- `DesignLabModalForm`
- `DesignLabModalField`
- `DesignLabModalFieldGrid`
- `DesignLabModalChipGroup`
- `DesignLabModalActions`
- `DesignLabModalInlineAction`

### Table

- `DesignLabColumnHeader`

## Vibbevennlig arbeidsregel

Når en ny `design-lab/...`-side bygges:

1. Kopier mønsteret fra en eksisterende `DesignLab*.tsx`-side.
2. Bruk eksisterende komponenter fra `src/components/designlab/system/*` og `src/components/designlab/controls.tsx`.
3. Hvis noe mangler, legg det til i systemlaget først.
4. Unngå å fikse design via global CSS.
5. Sjekk resultatet i både `design-lab/stilark` og den relevante `design-lab/...`-siden.

## Instruks til nye Codex-tråder

Bruk denne teksten når du starter en ny tråd:

> Viktig arbeidsregel for dette repoet: Design-lab er preview av ekte V2-komponenter og ekte sider. Bruk ekte V2-komponenter som sannhet. Ikke løs UI i global CSS eller design-lab-only overrides hvis det egentlig hører hjemme i komponentene. Ved tvil: bruk `src/components/designlab/system/*`, `src/components/designlab/controls.tsx`, `src/pages/DesignLabStyleguide.tsx` og relevante `src/pages/DesignLab*.tsx` som fasit. Hold workflowen enkel og vibbevennlig: foretrekk minste riktige endring i delte komponenter fremfor midlertidige snarveier.
