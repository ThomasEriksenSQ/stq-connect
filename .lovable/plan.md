

## Plan: Endre rekkefølge og stil på knappene i ansatt-headeren

### Endring i `src/pages/AnsattDetail.tsx` (linje 233–255)

Ny rekkefølge og styling:
1. **CV-editor** — blå knapp (`bg-primary text-primary-foreground`)
2. **Finn oppdrag** — blå knapp (`bg-primary text-primary-foreground`)
3. **Rediger** — outline-stil som i dag (`border border-border bg-background`)

CV-editor-knappen endres fra outline til blå primærstil for å matche Finn oppdrag.

