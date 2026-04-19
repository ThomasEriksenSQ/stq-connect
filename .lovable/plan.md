

## Mål
Legg til en subtil vertikal skillestrek mellom selskapskortet (venstre) og Kontakter-listen (høyre) i selskapsdetaljen på `/design-lab/selskaper`. V1 (`/selskap/:id`) skal ikke endres.

## Funn
- `CompanyCardContent.tsx` linje 1888–1907 bruker `ResizablePanelGroup` med en `ResizableHandle` som er **transparent som standard** og kun viser farge på hover/active (`!bg-transparent ... hover:!bg-[#DDE0E7]`). Det er derfor ingen synlig skillelinje mellom kolonnene.
- Komponenten er delt mellom V1 (`CompanyDetail.tsx`) og V2 (`DesignLabCompanies.tsx` linje 634).
- V2-flaten bruker allerede props-mønsteret (`headerPaddingTop`, `defaultHidden`, `onNavigateToFullPage`) for å tilpasse seg uten å endre V1.

## Endring
**`src/components/CompanyCardContent.tsx`**

1. Utvid `CompanyCardContentProps` med `showContactsDivider?: boolean` (default `false`).
2. Destructure i komponenten.
3. På `ResizableHandle` (linje 1893): når `showContactsDivider` er true, sett base-bakgrunn til `#E8EAEE` (`C.borderLight`) i stedet for `transparent`. Hover/active beholdes uendret.

```tsx
<ResizableHandle
  className={cn(
    "group !w-px after:hidden hover:!bg-[#DDE0E7] data-[resize-handle-active]:!bg-[#5E6AD2] transition-colors focus-visible:!ring-0 focus-visible:!ring-offset-0",
    showContactsDivider ? "!bg-[#E8EAEE]" : "!bg-transparent",
  )}
>
```

(Bytt også `!w-1` → `!w-px` når divider er aktiv, slik at linjen blir presis 1px — gripeflaten utvides via Radix sin interne hit-area.)

**`src/pages/DesignLabCompanies.tsx`** linje 634
Send `showContactsDivider` til `CompanyCardContent`:
```tsx
<CompanyCardContent
  companyId={selectedId}
  editable
  headerPaddingTop={12}
  showContactsDivider
  defaultHidden={{ techDna: true, notes: true }}
  onNavigateToFullPage={...}
/>
```

## Effekt
- V2 (`/design-lab/selskaper`): tynn `#E8EAEE` vertikal linje vises permanent mellom selskapsseksjonen og Kontakter-kolonnen, akkurat som i referansebildet. Hover/drag fungerer som før.
- V1 (`/selskap/:id`): uendret — ingen `showContactsDivider`-prop sendes, så fallback `transparent` brukes.

## Utenfor scope
- Ingen endring i V1 `CompanyDetail.tsx`.
- Ingen endring i resizable-bredder eller layout.
- Ingen endring i hover/active-styles på handle.

