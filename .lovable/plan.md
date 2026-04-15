

# Plan: Unified Shell + White Content Plane

## Problem
Sidebar, canvas, and content are all slightly different grays creating a "triple-gray" effect. Should be: unified shell + white working surfaces.

## Token changes in `theme.ts`

| Token | Current | New | Role |
|-------|---------|-----|------|
| `bg` (shell) | #F5F6F8 | **#F7F8FA** | Outermost shell |
| `sidebarBg` | #F7F8FA | **#F7F8FA** | Same as shell (disappears) |
| `surface` (bg-app) | #FAFBFC | **#FAFBFC** | Main canvas (keep) |
| `surfaceAlt` → rename conceptually | #F4F5F8 | **#F4F5F8** | Elevated controls (keep) |

Key: `bg` moves from #F5F6F8 → #F7F8FA so it matches `sidebarBg` exactly. Sidebar border-right stays `1px solid #E8EAEE`.

## Content surfaces → pure white

All content areas that currently use `C.surface` (#FAFBFC) change to **#FFFFFF**:
- Table body area
- Detail/right panel
- Consultant availability cards

New token value:
```
surface: "#FFFFFF"   // was #FAFBFC — now pure white working surface
```

This creates the "lift" effect: white content on a #F7F8FA shell.

## Table headers

Table column headers currently use `C.bg` for background. They should use `C.surfaceAlt` (#F4F5F8) to sit between shell and white content.

## Summary of file changes

| File | Change |
|------|--------|
| `theme.ts` | `bg`: #F5F6F8 → #F7F8FA, `surface`: #FAFBFC → #FFFFFF |
| `DesignLabContacts.tsx` | Table header bg: `C.bg` → `C.surfaceAlt` |
| `DesignLabForesporsler.tsx` | Same table header fix |
| `DesignLabStacqPrisen.tsx` | Same table header fix |

No layout, spacing, or functional changes.

