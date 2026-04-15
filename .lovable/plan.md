

# Plan: Collapsible sidebar for Design Lab

## Summary
Extract the duplicated sidebar into a shared component with a collapse/expand toggle. When collapsed, the sidebar shrinks to ~48px showing only icons. A small toggle button (chevron) at the bottom triggers the transition. State persists via `usePersistentState`.

## New file: `src/components/designlab/DesignLabSidebar.tsx`

A shared sidebar component used by all 4 Design Lab pages. Props: `navigate`, `signOut`, `user`, `activePath`.

**Collapsed state:**
- Width animates from 220px to 48px via CSS transition (`transition: width 200ms ease`)
- Only icons visible (no labels, no group headers, no email)
- STACQ logo shows just the "S" square
- Nav items show only icons, centered
- Footer: only Settings and LogOut icons
- A small `ChevronsLeft`/`ChevronsRight` toggle button at the bottom of the sidebar

**Expanded state:**
- Current 220px layout, identical to what exists now
- Toggle button shows `ChevronsLeft`

**Persistence:** `usePersistentState('dl-sidebar-collapsed', false)`

**Active item detection:** Derived from `activePath` prop instead of hardcoded `active: true` on nav items. Compare `item.href` with the current path.

## Changes to each Design Lab page

Replace the inline `<aside>...</aside>` block with:
```tsx
<DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/kontakter" />
```

Files affected:
- `src/pages/DesignLabContacts.tsx`
- `src/pages/DesignLabCompanies.tsx`
- `src/pages/DesignLabForesporsler.tsx`
- `src/pages/DesignLabStacqPrisen.tsx`

Also remove the duplicated `NavGroup`, `SidebarBtn` helper functions from each page (they move into the shared component), and remove the `NAV_MAIN`/`NAV_STACQ` constants (also moved).

## Design details

- Toggle button: 28px height, positioned at sidebar footer area, subtle `C.textFaint` color, `hover:bg C.hoverBg`
- Transition: `width` property with `200ms ease`, `overflow: hidden` to clip labels during animation
- Collapsed nav items: `justify-center`, tooltip on hover showing the label (using `title` attribute for simplicity)
- No layout shift in main content — main area uses `flex-1 min-w-0` which naturally fills remaining space

