

# Plan: Master-Detail Layout for DesignLabContacts

## Files modified
- `src/index.css` — add master-detail CSS classes
- `src/pages/DesignLabContacts.tsx` — replace ResizablePanelGroup with permanent layout

## 1. CSS additions (`src/index.css`)

Add after the existing `.content-wrapper` rule:

```css
.contacts-layout {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.contacts-toolbar {
  flex-shrink: 0;
}
.master-detail-layout {
  display: flex;
  flex-direction: row;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.master-pane {
  width: 680px;
  min-width: 560px;
  max-width: 780px;
  flex-shrink: 0;
  overflow: hidden;
  border-right: 1px solid #E8EAEE;
}
.detail-pane {
  flex: 1 1 auto;
  min-width: 420px;
  overflow: auto;
  background: #FFFFFF;
}

@media (max-width: 1600px) {
  .master-pane { width: 620px; }
}
@media (max-width: 1280px) {
  .master-pane { width: 56%; min-width: auto; max-width: none; }
}
@media (max-width: 1024px) {
  .detail-pane {
    position: fixed;
    inset: 0;
    z-index: 50;
    min-width: 0;
    background: #FFFFFF;
    box-shadow: -2px 0 10px rgba(0,0,0,0.06);
  }
  .detail-pane[data-empty="true"] {
    display: none;
  }
}
```

## 2. Component changes (`DesignLabContacts.tsx`)

**Remove**: `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` import (line 5).

**Replace lines 419–635** with:

```
<div className="content-wrapper contacts-layout">
  <div className="contacts-toolbar">
    {/* filter bar (lines 421-441) — unchanged */}
    {/* consultant availability bar (lines 443-471) — unchanged */}
  </div>
  <div className="master-detail-layout">
    <section className="master-pane">
      {/* inner div with h-full flex flex-col */}
      {/* sticky 6-column table header (always full: Navn, Signal, Selskap, Stilling, Eier, Varme) */}
      {/* scrollable rows area (overflow-y-auto, flex-1) */}
    </section>
    <aside className="detail-pane" data-empty={!sel ? "true" : undefined}>
      {sel ? (
        /* existing detail header + ContactCardContent (lines 538-572) */
      ) : (
        /* quiet empty state: pt-8 px-6, top-left aligned */
        /* Users icon 20px in C.textGhost */
        /* "Velg en kontakt" 13px/500/C.textFaint */
        /* "Klikk på en rad i listen" 12px/C.textGhost */
      )}
    </aside>
  </div>
</div>
```

**Master pane internal structure**: The pane uses `overflow: hidden` and contains a flex column with a sticky header row and a scrollable `overflow-y-auto` body — so the header stays pinned while rows scroll.

**Compact 3-column table variant** (lines 476-531) is removed entirely. One consistent 6-column table always.

**Mobile scroll lock**: `useEffect` watching `sel` and window width to toggle `document.body.classList.add/remove('overflow-hidden')` at `<1024px`, as a JS fallback alongside the CSS `:has()` approach.

## What stays unchanged
- Backgrounds, typography, spacing, sidebar, topbar, filter bar
- All existing detail panel content (header, tags, ContactCardContent)
- No other files modified

