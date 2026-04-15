

# Plan: Update Design Lab Surface Tokens

## Changes

**File: `src/components/designlab/theme.ts`**

Update 3 tokens + add 1 new token:

| Token | Current | New | Role |
|-------|---------|-----|------|
| `bg` | `#F5F6F8` | `#F5F6F8` | No change (shell) |
| `sidebarBg` | `#FFFFFF` | **`#F7F8FA`** | Sidebar gets its own subtle layer |
| `surface` | `#FAFBFC` | **`#FFFFFF`** | Panels/detail views become white |
| **`appBg`** | *(new)* | `#FAFBFC` | Main canvas background |

**Files: `DesignLabContacts.tsx`, `DesignLabForesporsler.tsx`, `DesignLabStacqPrisen.tsx`**

- Change `<main>` background from `C.surface` → `C.appBg`

Result: 4-layer hierarchy — Shell (`#F5F6F8`) → Sidebar (`#F7F8FA`) → Canvas (`#FAFBFC`) → Surface (`#FFFFFF`)

