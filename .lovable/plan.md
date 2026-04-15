

# Plan: Add `.content-wrapper` to Design Lab pages

## What

Add a `<div className="content-wrapper">` inside each `<main>`, wrapping all content **after** the header bar. This constrains content to 1280px max-width, left-aligned.

## CSS

Add to `src/index.css` (scoped by class, only used in Design Lab):

```css
.content-wrapper {
  max-width: 1280px;
  width: 100%;
  margin-left: 0;
  margin-right: auto;
}
```

## File changes

### `src/pages/DesignLabContacts.tsx`
Wrap lines 419–633 (filter bar + availability cards + contact list/detail) in `<div className="content-wrapper flex-1 flex flex-col min-h-0">`. The flex properties transfer from what's currently on the content sections so the layout still fills available space.

### `src/pages/DesignLabForesporsler.tsx`
Wrap lines 305–379 (filters + content list/detail) in `<div className="content-wrapper flex-1 flex flex-col min-h-0">`.

### `src/pages/DesignLabStacqPrisen.tsx`
Wrap lines 244–377 (stat line + chart + table) in `<div className="content-wrapper flex-1 flex flex-col min-h-0">`.

## Not changed
- Backgrounds, typography, spacing tokens
- Sidebar, topbar, page shell
- Non-design-lab pages
- No global CSS changes beyond the `.content-wrapper` class definition

