import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Users, Building2 } from "lucide-react";

import { C } from "@/components/designlab/theme";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  companyId: string | null;
  email: string;
  phone: string;
  signal: string;
  daysSince: number;
}

interface CompanyItem {
  id: string;
  name: string;
  contactCount: number;
}

interface SelectedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  signal: string;
}

interface SelectedCompany {
  id: string;
  name: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  textSize: TextSize;
  contacts: ContactItem[];
  companies: CompanyItem[];
  selectedContact: SelectedContact | null;
  selectedCompany?: SelectedCompany | null;
  onSelectContact: (id: string) => void;
  onSelectCompany?: (id: string, companyName: string) => void;
  onFilterByCompany: (companyName: string) => void;
  onResetSearch?: () => void;
  resetSearchLabel?: string;
}

/* ═══════════════════════════════════════════════════════════
   SECTION ITEM
   ═══════════════════════════════════════════════════════════ */

interface PaletteItem {
  id: string;
  label: string;
  meta?: string;
  icon: React.ElementType;
  action: () => void;
  section: string;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function CommandPalette({
  open,
  onClose,
  textSize,
  contacts,
  companies,
  selectedContact,
  selectedCompany,
  onSelectContact,
  onSelectCompany,
  onFilterByCompany,
  onResetSearch,
  resetSearchLabel = "Nullstill søk",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus input after mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build flat item list
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const result: PaletteItem[] = [];

    if (!q && onResetSearch) {
      result.push({
        id: "reset-search",
        label: resetSearchLabel,
        meta: "Vis hele listen igjen",
        icon: Search,
        section: "Handlinger",
        action: () => {
          onResetSearch();
          onClose();
        },
      });
    }

    // Kontakter
    if (contacts.length > 0) {
      const matched = q
        ? contacts.filter((c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
          ).slice(0, 5)
        : contacts.slice(0, 5);

      matched.forEach((c) => {
        result.push({
          id: `contact-${c.id}`,
          label: `${c.firstName} ${c.lastName}`,
          meta: c.company || undefined,
          icon: Users,
          section: "Kontakter",
          action: () => { onSelectContact(c.id); onClose(); },
        });
      });
    }

    // Selskaper
    if (companies.length > 0) {
      const matched = q
        ? companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5)
        : companies.slice(0, 5);

      matched.forEach((c) => {
        result.push({
          id: `company-${c.id}`,
          label: c.name,
          meta: `${c.contactCount} kontakter`,
          icon: Building2,
          section: "Selskaper",
          action: () => {
            if (onSelectCompany) onSelectCompany(c.id, c.name);
            else onFilterByCompany(c.name);
            onClose();
          },
        });
      });
    }

    return result;
  }, [query, contacts, companies, onSelectContact, onSelectCompany, onFilterByCompany, onResetSearch, resetSearchLabel, onClose]);

  // Clamp activeIdx
  useEffect(() => {
    setActiveIdx((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((p) => Math.min(p + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter" && items[activeIdx]) {
      e.preventDefault();
      e.stopPropagation();
      items[activeIdx].action();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }, [items, activeIdx, onClose]);

  // Scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  // Group items by section
  const sections: { label: string; items: (PaletteItem & { flatIdx: number })[] }[] = [];
  let currentSection = "";
  items.forEach((item, idx) => {
    if (item.section !== currentSection) {
      currentSection = item.section;
      sections.push({ label: item.section, items: [] });
    }
    sections[sections.length - 1].items.push({ ...item, flatIdx: idx });
  });

  // Truncate section header names
  const truncateName = (name: string, max = 28) =>
    name.length > max ? name.slice(0, max) + "…" : name;

  // Apply truncation to "Handlinger for ..." sections
  const displaySections = sections.map((s) => {
    const prefix = "Handlinger for ";
    if (s.label.startsWith(prefix)) {
      return { ...s, label: prefix + truncateName(s.label.slice(prefix.length)) };
    }
    return s;
  });

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.10)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "18vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          maxHeight: 420,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          boxShadow: C.shadowLg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...getDesignLabTextSizeStyle(textSize),
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{ position: "relative", height: 44, borderBottom: `1px solid ${C.borderLight}`, borderRadius: "10px 10px 0 0" }}>
          <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: C.textGhost }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Søk kontakt eller selskap..."
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              fontWeight: 400,
              color: C.text,
              fontFamily: "inherit",
              padding: "0 14px 0 40px",
            }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0 0" }}>
          {selectedContact || selectedCompany ? (
            <div style={{ padding: "6px 12px 8px", borderBottom: `1px solid ${C.borderLight}`, background: C.appBg }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textFaint, paddingBottom: 4 }}>
                Valgt
              </div>
              {selectedContact ? (
                <div style={{ fontSize: 12, color: C.text }}>
                  {selectedContact.firstName} {selectedContact.lastName}
                </div>
              ) : selectedCompany ? (
                <div style={{ fontSize: 12, color: C.text }}>
                  {selectedCompany.name}
                </div>
              ) : null}
            </div>
          ) : null}
          {displaySections.length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: C.textFaint }}>
              Ingen resultater for «{query}»
            </div>
          ) : (
            displaySections.map((section) => (
              <div key={section.label}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textFaint, padding: "8px 12px 4px", letterSpacing: 0 }}>
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.flatIdx === activeIdx;
                  return (
                    <div
                      key={item.id}
                      data-idx={item.flatIdx}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIdx(item.flatIdx)}
                      style={{
                        height: 28,
                        padding: "0 8px",
                        margin: "1px 6px",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 400,
                        color: C.text,
                        cursor: "pointer",
                        background: isActive ? C.hoverBg : C.surface,
                        transition: "background 120ms ease, color 120ms ease",
                      }}
                    >
                      <Icon style={{ width: 14, height: 14, color: isActive ? C.textFaint : C.textGhost, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      {item.meta && (
                        <span style={{ fontSize: 11, color: isActive ? C.textMuted : C.textFaint, marginLeft: "auto", flexShrink: 0 }}>
                          {item.meta}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
