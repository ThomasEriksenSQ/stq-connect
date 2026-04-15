

# Plan: ⌘K Command Palette for Design Lab

## Summary
Create a self-contained command palette component at `src/components/designlab/CommandPalette.tsx` and mount it inside `DesignLabContacts.tsx`. The palette intercepts ⌘K (replacing current focus-search behavior) and provides 6 sections of searchable actions.

## Technical Design

### New file: `src/components/designlab/CommandPalette.tsx`

A single React component (~400 lines) using portal/fixed overlay pattern. No external dependencies beyond existing React, lucide-react, react-router-dom, and the Design Lab theme.

**Props interface:**
```ts
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  contacts: Array<{ id, firstName, lastName, company, companyId, email, phone, signal, daysSince }>;
  companies: Array<{ id, name, contactCount: number }>;
  selectedContact: { id, firstName, lastName, email, signal } | null;
  onSelectContact: (id: string) => void;
  onNavigate: (path: string) => void;
}
```

**Architecture:**
- Fixed overlay (rgba(0,0,0,0.15), no blur) + centered 560px modal
- Uncontrolled internal search state, filters all sections simultaneously
- Keyboard nav via `activeIndex` tracking across flattened visible items
- All styling inline using `C` tokens from theme.ts — zero Tailwind classes that could leak

**6 Sections (rendered conditionally):**

1. **Handlinger for [navn]** — Only when `selectedContact` is set. Items: Logg samtale, Logg møte, Ny oppfølging, Ny forespørsel, Kopier e-post, Endre signal. Actions dispatch to existing ContactCardContent action handlers by programmatically clicking the relevant buttons or using `navigator.clipboard` for email copy.

2. **Varsler** — Skipped in v1. No standalone warning logic exists in design-lab outside ContactCardContent. Will be added in v2.

3. **Kontakter** — Fuzzy search against `contacts` prop, top 5. Click → `onSelectContact(id)`.

4. **Selskaper** — Derived from contacts' unique companies with count. Top 5. Click → filter contact list by company (set search to company name).

5. **Opprett** — Static 4 items. For now: Ny kontakt, Nytt selskap, Ny forespørsel, Ny oppfølging. Actions use `toast.info("Kommer snart")` placeholder since Design Lab doesn't have creation dialogs yet.

6. **Naviger til** — Static 4 items mapping to routes: `/design-lab/kontakter`, `/design-lab/foresporsler`, `/design-lab/stacq-prisen`, `/`.

**Empty state:** "Ingen resultater for «[query]»" when all sections are empty after filtering.

### Modified file: `src/pages/DesignLabContacts.tsx`

Minimal changes:
1. Import `CommandPalette`
2. Add `const [cmdOpen, setCmdOpen] = useState(false)` state
3. Update existing ⌘K handler (line 101-114): instead of focusing search input, toggle `setCmdOpen(true)`
4. Derive `companiesList` from `contacts` (unique companies with contact count)
5. Render `<CommandPalette>` at end of component with all props wired
6. Sidebar ⌘K button (line 380-391): `onClick={() => setCmdOpen(true)}` instead of focusing search

### Visual specs (all from the user's spec)
- 560px wide, top 20vh, 8px radius, `C.shadowLg` shadow
- 44px input, 14px font, no border, bottom divider `C.borderLight`
- 34px result rows, 5px radius, `C.hoverBg` on hover/keyboard-active
- Section headers: 11px/500, `C.textFaint`, 10px 16px 4px padding
- Icons: 16px lucide, `C.textFaint`
- Meta text: 12px, `C.textFaint`, right-aligned

### Files changed
- **New:** `src/components/designlab/CommandPalette.tsx`
- **Modified:** `src/pages/DesignLabContacts.tsx` (import + state + handler changes)

No other files affected.

