

## Legg til "Uten eier" og "Ikke relevant kontakt" filter-chips

### Endringer i `src/pages/Contacts.tsx`

**1. Eier-raden (linje 1508): Legg til "Uten eier" chip**

Etter `uniqueOwners.map(...)` på linje 1508, legg til:
```tsx
<Chip label="Uten eier" value="__none__" current={ownerFilter} onSelect={setOwnerFilter} />
```

**2. Eier-filterlogikken (linje 705): Håndter `__none__` verdien**

Utvid `matchOwner`-sjekken til:
```ts
const matchOwner = ownerFilter === "all" 
  || ownerFilter === "__none__" ? !getOwnerId(contact) 
  : getOwnerId(contact) === ownerFilter;
```

**3. Type-raden (linje 1540): Legg til "Ikke relevant" chip**

Etter CV-Epost-chipen, legg til:
```tsx
<Chip label="Ikke relevant" value="ikke_aktuell" current={typeFilter} onSelect={setTypeFilter} />
```

**4. Type-filterlogikken (linje 710): Håndter `ikke_aktuell`**

Legg til i `matchType`:
```ts
|| (typeFilter === "ikke_aktuell" && contact.ikke_aktuell_kontakt)
```

Ingen andre endringer. Kun to nye filter-chips og tilhørende filterlogikk.

