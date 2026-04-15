import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search, Phone, FileText, Clock, Briefcase, Copy, Signal,
  Users, Building2, Plus, ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
  const navigate = useNavigate();

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

    // 1. Handlinger for kontakt
    if (selectedContact) {
      const name = `${selectedContact.firstName} ${selectedContact.lastName}`;
      const sectionLabel = `Handlinger for ${name}`;
      const actions: PaletteItem[] = [
        { id: "act-call", label: `Logg telefonsamtale med ${name}`, icon: Phone, section: sectionLabel, action: () => { onClose(); toast.info("Åpne kontakten og bruk 'Logg samtale'"); } },
        { id: "act-meeting", label: `Logg møte med ${name}`, icon: FileText, section: sectionLabel, action: () => { onClose(); toast.info("Åpne kontakten og bruk 'Logg møtereferat'"); } },
        { id: "act-followup", label: `Ny oppfølging for ${name}`, icon: Clock, section: sectionLabel, action: () => { onClose(); toast.info("Åpne kontakten og bruk 'Ny oppfølging'"); } },
        { id: "act-request", label: `Ny forespørsel for ${name}`, icon: Briefcase, section: sectionLabel, action: () => { onClose(); toast.info("Åpne kontakten og bruk 'Ny forespørsel'"); } },
        { id: "act-email", label: "Kopier e-post", meta: selectedContact.email || "—", icon: Copy, section: sectionLabel, action: () => {
          if (selectedContact.email) { navigator.clipboard.writeText(selectedContact.email); toast.success("E-post kopiert"); }
          else { toast.info("Ingen e-post registrert"); }
          onClose();
        }},
        { id: "act-signal", label: `Endre signal for ${name}`, icon: Signal, section: sectionLabel, action: () => { onClose(); toast.info("Bruk signal-dropdown i kontaktkortet"); } },
      ];
      if (q) {
        result.push(...actions.filter((a) => a.label.toLowerCase().includes(q)));
      } else {
        result.push(...actions);
      }
    }

    // 2. Varsler — skipped in v1

    // 3. Kontakter
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

    // 4. Selskaper
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

    // 5. Opprett
    const createItems: PaletteItem[] = [
      { id: "create-contact", label: "Ny kontakt", icon: Plus, section: "Opprett", action: () => { onClose(); toast.info("Kommer snart"); } },
      { id: "create-company", label: "Nytt selskap", icon: Plus, section: "Opprett", action: () => { onClose(); toast.info("Kommer snart"); } },
      { id: "create-request", label: "Ny forespørsel", icon: Plus, section: "Opprett", action: () => { onClose(); toast.info("Kommer snart"); } },
      { id: "create-followup", label: "Ny oppfølging", icon: Plus, section: "Opprett", action: () => { onClose(); toast.info("Kommer snart"); } },
    ];
    if (q) {
      result.push(...createItems.filter((i) => i.label.toLowerCase().includes(q)));
    } else {
      result.push(...createItems);
    }

    // 6. Naviger til
    const navItems: PaletteItem[] = [
      { id: "nav-contacts", label: "Kontakter", icon: ArrowRight, section: "Naviger til", action: () => { navigate("/design-lab/kontakter"); onClose(); } },
      { id: "nav-requests", label: "Forespørsler", icon: ArrowRight, section: "Naviger til", action: () => { navigate("/design-lab/foresporsler"); onClose(); } },
      { id: "nav-price", label: "STACQ Prisen", icon: ArrowRight, section: "Naviger til", action: () => { navigate("/design-lab/stacq-prisen"); onClose(); } },
      { id: "nav-agent", label: "Salgsagent", icon: ArrowRight, section: "Naviger til", action: () => { navigate("/"); onClose(); } },
    ];
    if (q) {
      result.push(...navItems.filter((i) => i.label.toLowerCase().includes(q)));
    } else {
      result.push(...navItems);
    }

    return result;
  }, [query, contacts, companies, selectedContact, onSelectContact, onFilterByCompany, onClose, navigate]);

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

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.15)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "20vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          maxHeight: 420,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          boxShadow: C.shadowLg,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", height: 44, padding: "0 16px", borderBottom: `1px solid ${C.borderLight}` }}>
          <Search style={{ width: 16, height: 16, color: C.textFaint, flexShrink: 0, marginRight: 10 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Søk kontakt, selskap, handling..."
            style={{
              flex: 1,
              height: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              fontWeight: 400,
              color: C.text,
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0 8px" }}>
          {sections.length === 0 ? (
            <div style={{ padding: "24px 16px", fontSize: 13, color: C.textFaint }}>
              Ingen resultater for «{query}»
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.label}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.textFaint, padding: "10px 16px 4px" }}>
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
                        height: 34,
                        padding: "0 10px",
                        margin: "0 6px",
                        borderRadius: 5,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 13,
                        fontWeight: 400,
                        color: C.text,
                        cursor: "pointer",
                        background: isActive ? C.hoverBg : "transparent",
                      }}
                    >
                      <Icon style={{ width: 16, height: 16, color: C.textFaint, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      {item.meta && (
                        <span style={{ fontSize: 12, color: C.textFaint, marginLeft: "auto", flexShrink: 0 }}>{item.meta}</span>
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
