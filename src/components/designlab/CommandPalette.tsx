import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Users, Building2 } from "lucide-react";

import { C } from "@/components/designlab/theme";

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

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  contacts: ContactItem[];
  companies: CompanyItem[];
  selectedContact: SelectedContact | null;
  onSelectContact: (id: string) => void;
  onFilterByCompany: (companyName: string) => void;
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
  contacts,
  companies,
  selectedContact,
  onSelectContact,
  onFilterByCompany,
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
          action: () => { onFilterByCompany(c.name); onClose(); },
        });
      });
    }

    return result;
  }, [query, contacts, companies, onSelectContact, onFilterByCompany, onClose]);

  // Clamp activeIdx
  useEffect(() => {
    setActiveIdx((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((p) => Math.min(p + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter" && items[activeIdx]) {
      e.preventDefault();
      items[activeIdx].action();
    } else if (e.key === "Escape") {
      e.preventDefault();
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
          background: "#FFFFFF",
          border: "1px solid #E2E4E9",
          borderRadius: 10,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.10), 0 24px 48px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{ position: "relative", height: 44, borderBottom: "1px solid #EAECEF", borderRadius: "10px 10px 0 0" }}>
          <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#B0B7C3" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Søk kontakt, selskap, handling..."
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              fontWeight: 400,
              color: "#1A1C1F",
              fontFamily: "inherit",
              padding: "0 14px 0 40px",
            }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0 0" }}>
          {displaySections.length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: "#B0B7C3" }}>
              Ingen resultater for «{query}»
            </div>
          ) : (
            displaySections.map((section) => (
              <div key={section.label}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#B0B7C3", padding: "8px 12px 3px", letterSpacing: 0 }}>
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
                        height: 30,
                        padding: "0 8px",
                        margin: "1px 6px",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 400,
                        color: "#1A1C1F",
                        cursor: "pointer",
                        background: isActive ? "#ECEEF5" : "transparent",
                      }}
                    >
                      <Icon style={{ width: 14, height: 14, color: isActive ? "#8C929C" : "#C1C7D0", flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      {item.meta && (
                        <span style={{ fontSize: 12, color: isActive ? "#8C929C" : "#B0B7C3", marginLeft: "auto", flexShrink: 0 }}>{item.meta}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Bottom hint bar */}
        <div style={{
          height: 30,
          borderTop: "1px solid #EAECEF",
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "#FAFBFC",
          borderRadius: "0 0 10px 10px",
          flexShrink: 0,
        }}>
          {[
            { kbd: "↑↓", label: "naviger" },
            { kbd: "↵", label: "velg" },
            { kbd: "esc", label: "lukk" },
          ].map((h) => (
            <span key={h.kbd} style={{ fontSize: 11, color: "#C1C7D0", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 10, background: "#EAECEF", borderRadius: 3, padding: "1px 4px", color: "#8C929C", marginRight: 3 }}>{h.kbd}</span>
              {h.label}
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
