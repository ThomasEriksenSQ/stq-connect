

# Plan: V8 Linear-styling for kontaktdetalj i Design Lab

## Hva skal gjøres

Kontaktdetalj-panelet i Design Lab bruker i dag produksjonskomponenten `ContactCardContent` direkte, som har standard Tailwind/shadcn-styling. Vi skal reskinne dette panelet til å matche V8-designet (off-white, grafitt, dempet teal) via en CSS-overrideklasse som wrapperen rundt `ContactCardContent` setter.

## Tilnærming

Istedenfor å skrive en kopi av den 2348-linjer store `ContactCardContent`, legger vi en CSS-klasse `.dl-v8-theme` rundt panelet som overstyrer nøkkelvariabler og Tailwind-klasser. Dette sikrer at all funksjonalitet beholdes mens utseendet tilpasses.

## Tekniske endringer

### 1. `src/index.css` — Legg til `.dl-v8-theme` override-blokk

Definerer CSS custom properties innenfor `.dl-v8-theme` som overstyrer `--background`, `--foreground`, `--primary`, `--border`, `--muted-foreground`, `--secondary` osv. til V8-paletten:
- Background: `#F7F6F2`
- Foreground/text: `#28251D`
- Primary/accent: `#01696F`
- Border: `rgba(40,37,29,0.08)`
- Muted foreground: `#6B6B66`
- Secondary bg: `rgba(40,37,29,0.04)`
- Destructive: `#9a4a4a`
- Success: `#4a9a6a`
- Warning: `#9a7a2a`

Tilleggs-CSS-regler innenfor `.dl-v8-theme` for:
- Knapper (rounded-full pills) → mer dempede border og farger
- Badges → V8-fargetoner istedenfor Tailwind-fargene
- Overskrifter → Inter font, V8-vekter
- Inputs/textareas → subtilere borders
- Action buttons (Logg samtale, etc.) → V8 teal/dempede toner
- Kategori-badges → dempede, desaturerte farger

### 2. `src/pages/DesignLabContacts.tsx` — Wrap ContactCardContent

Endring i linje ~518: Wrap `ContactCardContent` i en `<div className="dl-v8-theme">` slik at alle CSS-overridene aktiveres kun i Design Lab-konteksten.

```tsx
<div className="flex-1 overflow-y-auto px-6 py-5 dl-v8-theme">
  <ContactCardContent contactId={sel.id} editable />
</div>
```

### Hva endres visuelt
- Bakgrunn: varm off-white istedenfor ren hvit
- Tekst: dyp grafitt istedenfor svart
- Borders: ultra-subtile istedenfor standard grå
- Primærknapper: dempet teal istedenfor default primary
- Kategori-badges: dempede pasteller istedenfor mettede Tailwind-farger
- Action-knapper: V8-palett (teal for samtale, grafitt for møte)
- Teknologi-tags: nøytral bakgrunn med V8-border
- Seksjonsheadere: 11px uppercase, V8 muted color

### Hva endres IKKE
- All funksjonalitet (inline edit, dropdowns, mutations)
- Produksjons-ContactCardContent påvirkes ikke
- Data-henting og state management

