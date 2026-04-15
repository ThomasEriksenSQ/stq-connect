

# Plan: Dropdown-meny og skjul/vis-logikk — kun Design Lab

## Tilnærming

Legge til en `defaultHidden`-prop på `ContactCardContent` som styrer standardvisning av valgfrie seksjoner. Design Lab sender denne propen — alle andre sider forblir uendret.

I tillegg flyttes 3-prikker-menyen inn i kontaktkortets header (kun synlig når `defaultHidden` er aktiv).

## Endringer

### 1. `src/components/ContactCardContent.tsx`

**Ny prop:**
```ts
defaultHidden?: {
  techDna?: boolean;
  notes?: boolean;
  consultantMatch?: boolean;
  linkedinIfEmpty?: boolean;
  locationsIfEmpty?: boolean;
}
```

**Ny state (kun når `defaultHidden` er satt):**
- `showTechDna` — default `false`
- `showNotes` — default `false`
- `showConsultantMatch` — default `false`

**3-prikker-meny i headeren** (kun når `defaultHidden`-prop finnes):
- Import `MoreHorizontal` fra lucide-react
- Plasseres etter eier-badge i header-raden
- Menyvalg:
  - **Rediger profil** — scroller til navnfeltet
  - **Finn konsulent** — toggler `showConsultantMatch` + trigger matching
  - **Legg til notat** — toggler `showNotes` + åpner editor
  - **Vis/skjul teknisk DNA** — toggler `showTechDna`
  - **Vis/skjul notat** — toggler `showNotes` (synlig kun når notat finnes)

**Betinget visning:**
- Teknisk DNA + tech chips: wrap i `{(!defaultHidden?.techDna || showTechDna) && (...)}`
- Notat: wrap i `{(!defaultHidden?.notes || showNotes) && (...)}`
- Finn konsulent-resultater: wrap i `{(!defaultHidden?.consultantMatch || showConsultantMatch) && (...)}`
- LinkedIn: skjul tom placeholder når `defaultHidden?.linkedinIfEmpty && !contact.linkedin`
- Steder/locations: skjul når `defaultHidden?.locationsIfEmpty && contactLocations.length === 0`

### 2. `src/pages/DesignLabContacts.tsx`

Endre linje 587:
```tsx
<ContactCardContent
  contactId={sel.id}
  editable
  defaultHidden={{ techDna: true, notes: true, consultantMatch: true, linkedinIfEmpty: true, locationsIfEmpty: true }}
/>
```

### Filer som endres
- `src/components/ContactCardContent.tsx` — ny prop, state, dropdown-meny, betinget visning
- `src/pages/DesignLabContacts.tsx` — sender `defaultHidden`-prop

Ingen andre filer endres. Standard kontaktsider (`ContactDetail.tsx`, `Contacts.tsx`) forblir uberørt.

