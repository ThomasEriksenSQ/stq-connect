import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, X, Phone, Mail, FileText } from "lucide-react";

/* ── Minimal Top Strip ── */
function TopStrip() {
  return (
    <header
      className="h-12 flex items-center justify-between px-6 border-b"
      style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}
    >
      <span
        className="tracking-tight"
        style={{ fontWeight: 800, fontSize: 18, color: "#111827", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        STACQ
      </span>
      <div className="relative w-full max-w-md mx-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
        <input
          placeholder="Søk kontakter, selskaper…  ⌘K"
          className="w-full h-8 pl-9 pr-3 rounded-lg text-sm outline-none"
          style={{
            background: "#F3F4F6",
            color: "#111827",
            fontFamily: "Inter, system-ui, sans-serif",
            border: "none",
          }}
        />
      </div>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
        style={{ background: "#111827", color: "#FFFFFF" }}
      >
        JR
      </div>
    </header>
  );
}

/* ── Signal type ── */
type Signal = "Behov nå" | "Fremtidig behov" | "Har kanskje behov" | "Ukjent om behov" | "Aldri aktuelt";

const SIGNAL_STYLES: Record<Signal, { bg: string; text: string; border: string }> = {
  "Behov nå": { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  "Fremtidig behov": { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  "Har kanskje behov": { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  "Ukjent om behov": { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB" },
  "Aldri aktuelt": { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
};

function SignalBadge({ signal }: { signal: Signal }) {
  const s = SIGNAL_STYLES[signal];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {signal}
    </span>
  );
}

/* ── Mock data ── */
interface MockContact {
  id: string;
  navn: string;
  stilling: string;
  selskap: string;
  signal: Signal;
  eier: string;
  sisteAktivitet: string;
  sisteType: "Samtale" | "Møte" | "E-post";
  nesteSteg: string | null;
  nesteDato: string | null;
  lokasjon: string;
  tags: string[];
  harCv: boolean;
  selskapstype: "Kunde" | "Potensiell";
  aktiveOppdrag: number;
}

const CONTACTS: MockContact[] = [
  {
    id: "1", navn: "Erik Solberg", stilling: "Tech Lead", selskap: "Aker Solutions",
    signal: "Behov nå", eier: "Jon Richard Nygaard", sisteAktivitet: "11. apr 2026",
    sisteType: "Samtale", nesteSteg: "Send CV-er ML-kandidater", nesteDato: "16. apr 2026",
    lokasjon: "Oslo", tags: ["Python", "ML", "GCP", "TensorFlow"],
    harCv: false, selskapstype: "Kunde", aktiveOppdrag: 2,
  },
  {
    id: "2", navn: "Kari Hansen", stilling: "Engineering Manager", selskap: "DNB",
    signal: "Behov nå", eier: "Thomas Eriksen", sisteAktivitet: "10. apr 2026",
    sisteType: "Møte", nesteSteg: "Book demo med teamleder", nesteDato: "18. apr 2026",
    lokasjon: "Oslo", tags: ["Java", "Kotlin", "AWS", "Microservices"],
    harCv: true, selskapstype: "Kunde", aktiveOppdrag: 3,
  },
  {
    id: "3", navn: "Silje Strand", stilling: "Data Engineering Lead", selskap: "Schibsted",
    signal: "Behov nå", eier: "Jon Richard Nygaard", sisteAktivitet: "9. apr 2026",
    sisteType: "Samtale", nesteSteg: "Sende profil Spark-konsulent", nesteDato: "15. apr 2026",
    lokasjon: "Oslo", tags: ["Spark", "Kafka", "Databricks", "Python"],
    harCv: false, selskapstype: "Kunde", aktiveOppdrag: 1,
  },
  {
    id: "4", navn: "Magnus Pedersen", stilling: "VP Engineering", selskap: "Cognite",
    signal: "Fremtidig behov", eier: "Jon Richard Nygaard", sisteAktivitet: "5. apr 2026",
    sisteType: "Møte", nesteSteg: "Følg opp Q3-behov", nesteDato: "1. mai 2026",
    lokasjon: "Oslo", tags: ["TypeScript", "React", "Rust", "Kubernetes"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
  {
    id: "5", navn: "Ingrid Moe", stilling: "CTO", selskap: "Vipps",
    signal: "Fremtidig behov", eier: "Thomas Eriksen", sisteAktivitet: "3. apr 2026",
    sisteType: "E-post", nesteSteg: "Lunsj i mai", nesteDato: "8. mai 2026",
    lokasjon: "Oslo", tags: ["Go", "Kubernetes", "Azure", "Fintech"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
  {
    id: "6", navn: "Henrik Berg", stilling: "Platform Lead", selskap: "Equinor",
    signal: "Behov nå", eier: "Jon Richard Nygaard", sisteAktivitet: "12. apr 2026",
    sisteType: "Samtale", nesteSteg: "Presentere 2 DevOps-profiler", nesteDato: "17. apr 2026",
    lokasjon: "Stavanger", tags: ["Azure", "Terraform", "DevOps", "Python"],
    harCv: true, selskapstype: "Kunde", aktiveOppdrag: 4,
  },
  {
    id: "7", navn: "Lene Johansen", stilling: "Head of Digital", selskap: "Storebrand",
    signal: "Har kanskje behov", eier: "Thomas Eriksen", sisteAktivitet: "28. mar 2026",
    sisteType: "Møte", nesteSteg: null, nesteDato: null,
    lokasjon: "Oslo", tags: ["Java", "Spring Boot", "AWS"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
  {
    id: "8", navn: "Andreas Dahl", stilling: "Senior Engineering Manager", selskap: "Telenor",
    signal: "Fremtidig behov", eier: "Jon Richard Nygaard", sisteAktivitet: "1. apr 2026",
    sisteType: "Samtale", nesteSteg: "Sjekk 5G-prosjekt status", nesteDato: "25. apr 2026",
    lokasjon: "Fornebu", tags: ["Java", "React", "5G", "Cloud Native"],
    harCv: false, selskapstype: "Kunde", aktiveOppdrag: 1,
  },
  {
    id: "9", navn: "Marte Eriksen", stilling: "Tech Director", selskap: "Kahoot!",
    signal: "Ukjent om behov", eier: "Thomas Eriksen", sisteAktivitet: "15. mar 2026",
    sisteType: "E-post", nesteSteg: "Intro-møte", nesteDato: "22. apr 2026",
    lokasjon: "Oslo", tags: ["TypeScript", "Node.js", "React", "AWS"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
  {
    id: "10", navn: "Ola Kristiansen", stilling: "IT-sjef", selskap: "Posten",
    signal: "Har kanskje behov", eier: "Jon Richard Nygaard", sisteAktivitet: "20. mar 2026",
    sisteType: "Samtale", nesteSteg: null, nesteDato: null,
    lokasjon: "Oslo", tags: ["SAP", ".NET", "Azure", "Logistics"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
  {
    id: "11", navn: "Camilla Vik", stilling: "VP Technology", selskap: "Statkraft",
    signal: "Fremtidig behov", eier: "Thomas Eriksen", sisteAktivitet: "8. apr 2026",
    sisteType: "Møte", nesteSteg: "Send rammeavtale-info", nesteDato: "28. apr 2026",
    lokasjon: "Oslo", tags: ["Python", "Data Science", "Energy", "Azure"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
  {
    id: "12", navn: "Thomas Lie", stilling: "CTO", selskap: "Color Line",
    signal: "Aldri aktuelt", eier: "Jon Richard Nygaard", sisteAktivitet: "10. feb 2026",
    sisteType: "E-post", nesteSteg: null, nesteDato: null,
    lokasjon: "Sandefjord", tags: [".NET", "Azure"],
    harCv: false, selskapstype: "Potensiell", aktiveOppdrag: 0,
  },
];

const OWNERS = ["Alle", "Jon Richard Nygaard", "Thomas Eriksen"];
const SIGNALS: Signal[] = ["Behov nå", "Fremtidig behov", "Har kanskje behov", "Ukjent om behov", "Aldri aktuelt"];

const ACTIVITY_ICON: Record<string, typeof Phone> = {
  Samtale: Phone,
  Møte: FileText,
  "E-post": Mail,
};

/* ── Filter pill ── */
function FilterPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "Alle" && value !== "";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors"
        style={{
          background: active ? "#111827" : "#FFFFFF",
          color: active ? "#FFFFFF" : "#6B7280",
          border: `1px solid ${active ? "#111827" : "#E5E7EB"}`,
        }}
      >
        {label}{value !== "Alle" && value !== "" ? `: ${value}` : ""}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-10 left-0 z-20 rounded-lg py-1 min-w-[180px]"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                style={{
                  color: "#111827",
                  fontWeight: (value === opt) ? 600 : 400,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function DesignLabContacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("Alle");
  const [signalFilter, setSignalFilter] = useState("Alle");

  const hasFilters = ownerFilter !== "Alle" || signalFilter !== "Alle" || search !== "";

  const filtered = useMemo(() => {
    return CONTACTS.filter((c) => {
      if (ownerFilter !== "Alle" && c.eier !== ownerFilter) return false;
      if (signalFilter !== "Alle" && c.signal !== signalFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.navn.toLowerCase().includes(q) ||
          c.selskap.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [search, ownerFilter, signalFilter]);

  const font = "Inter, system-ui, sans-serif";

  return (
    <div className="min-h-screen" style={{ background: "#FAFAFA", fontFamily: font }}>
      <TopStrip />

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="mb-1" style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
            Kontakter
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280" }}>
            {filtered.length} kontakter
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9CA3AF" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk etter navn, selskap eller teknologi…"
              className="w-full h-10 pl-9 pr-3 rounded-lg text-sm outline-none"
              style={{
                background: "#FFFFFF",
                color: "#111827",
                border: "1px solid #E5E7EB",
                fontFamily: font,
              }}
            />
          </div>
          <FilterPill label="Eier" value={ownerFilter} options={OWNERS} onChange={setOwnerFilter} />
          <FilterPill label="Signal" value={signalFilter} options={["Alle", ...SIGNALS]} onChange={setSignalFilter} />
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setOwnerFilter("Alle"); setSignalFilter("Alle"); }}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              style={{ color: "#6B7280" }}
            >
              <X className="w-3 h-3" />
              Nullstill
            </button>
          )}
        </div>

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {/* Table header */}
          <div
            className="grid items-center px-5 h-10"
            style={{
              gridTemplateColumns: "minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.6fr)",
              borderBottom: "1px solid #E5E7EB",
              background: "#FAFAFA",
            }}
          >
            {["KONTAKT", "SELSKAP", "SIGNAL", "EIER", "SISTE AKTIVITET", "NESTE STEG"].map((col) => (
              <span
                key={col}
                style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((c) => {
            const Icon = ACTIVITY_ICON[c.sisteType] || Phone;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/design-lab/kontakter/${c.id}`)}
                className="grid items-center px-5 cursor-pointer transition-colors hover:bg-[#F9FAFB]"
                style={{
                  gridTemplateColumns: "minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.6fr)",
                  minHeight: 64,
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                {/* Contact */}
                <div className="flex items-center gap-3 py-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: "#F3F4F6", color: "#6B7280" }}
                  >
                    {c.navn.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
                        {c.navn}
                      </span>
                      {c.harCv && (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: "#DBEAFE", color: "#1E40AF" }}
                        >
                          CV
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="truncate" style={{ fontSize: 13, color: "#6B7280" }}>
                        {c.stilling}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Company */}
                <div className="min-w-0">
                  <span className="truncate block" style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>
                    {c.selskap}
                  </span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    {c.selskapstype}{c.aktiveOppdrag > 0 ? ` · ${c.aktiveOppdrag} oppdrag` : ""}
                  </span>
                </div>

                {/* Signal */}
                <div>
                  <SignalBadge signal={c.signal} />
                </div>

                {/* Owner */}
                <span className="truncate" style={{ fontSize: 13, color: "#6B7280" }}>
                  {c.eier}
                </span>

                {/* Last activity */}
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#9CA3AF" }} />
                  <div className="min-w-0">
                    <span className="block truncate" style={{ fontSize: 13, color: "#6B7280" }}>
                      {c.sisteType}
                    </span>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{c.sisteAktivitet}</span>
                  </div>
                </div>

                {/* Next step */}
                <div className="min-w-0">
                  {c.nesteSteg ? (
                    <>
                      <span className="block truncate" style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>
                        {c.nesteSteg}
                      </span>
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>{c.nesteDato}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: "#D1D5DB" }}>—</span>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 text-center" style={{ color: "#9CA3AF", fontSize: 14 }}>
              Ingen kontakter funnet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
