

## Plan: Fjern telefonnummer fra selskapsnivå

Telefonnummer på selskaper er et artefakt fra en gammel import og skal ikke vises. Endringen er kun visuell — feltet fjernes fra visningen i headeren på selskapssiden.

### Endring

**Fil:** `src/components/CompanyCardContent.tsx` (linje 1027–1034)

Fjern blokken som viser `company.phone` i metadata-raden (org.nr · by · telefon · lenker):

```tsx
// Fjern denne blokken:
{company.phone && (
  <>
    <span className="text-muted-foreground/40">·</span>
    <a href={`tel:${company.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
      <Phone className="h-3 w-3" />
      {company.phone}
    </a>
  </>
)}
```

Ingen andre filer berøres. `Phone`-ikonet kan beholdes i importen da det muligens brukes andre steder i filen (kontaktskjema).

