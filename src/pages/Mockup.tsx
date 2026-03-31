import { useState } from "react";

const contacts = [
  { id: 1, name: "Erik Solberg", company: "Kongsberg Digital", title: "CTO", signal: "Behov nå", score: 72, heat: "hot", last: "28. mar" },
  { id: 2, name: "Linn Hagen", company: "Equinor", title: "Innkjøpsleder", signal: "Behov nå", score: 65, heat: "hot", last: "21. mar" },
  { id: 3, name: "Mads Bakke", company: "Aker Solutions", title: "IT-sjef", signal: "Fremtidig", score: 44, heat: "warm", last: "5. mar" },
  { id: 4, name: "Silje Nordberg", company: "DNV", title: "Prosjektleder", signal: "Fremtidig", score: 38, heat: "warm", last: "18. feb" },
  { id: 5, name: "Tone Viken", company: "Norsk Helsenett", title: "Direktør", signal: "Ukjent", score: 12, heat: "cold", last: "2. jan" },
  { id: 6, name: "Per Strand", company: "Sintef", title: "Forsker", signal: "Ukjent", score: 8, heat: "cold", last: "Nov 2024" },
];

const heatColor: Record<string, string> = {
  hot: "#16A34A",
  warm: "#D97706",
  cold: "#D1D5DB",
};

const signalStyle: Record<string, { bg: string; color: string }> = {
  "Behov nå":  { bg: "#F0FDF4", color: "#15803D" },
  "Fremtidig": { bg: "#EFF6FF", color: "#1D4ED8" },
  "Ukjent":    { bg: "#F4F4F5", color: "#71717A" },
};

export default function Mockup() {
  const [selected, setSelected] = useState(contacts[0]);
  const [view, setView] = useState<"contacts" | "home">("contacts");

  return (
    <div style={{ minHeight: "100vh", background: "#F7F7F8", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      <div style={{ textAlign: "center", padding: "10px 0 0", fontSize: 11, color: "#9CA3AF", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        STACQ CRM — Design Mockup (Linear-inspirert)
      </div>

      {/* Shell */}
      <div style={{ margin: "8px auto 0", maxWidth: 1280, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)", background: "#fff", minHeight: "calc(100vh - 48px)" }}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", height: 48, borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 16px", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15, marginRight: 20, letterSpacing: "-0.02em" }}>STACQ</span>

          {[
            { label: "Hjem", id: "home" },
            { label: "Kontakter", id: "contacts" },
            { label: "Selskaper", id: "contacts" },
            { label: "Oppfølginger", id: "contacts" },
          ].map((item) => {
            const active = (item.id === "home" && view === "home") || (item.id === "contacts" && view === "contacts" && item.label === "Kontakter");
            return (
              <button
                key={item.label}
                onClick={() => setView(item.id as "contacts" | "home")}
                style={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#111318" : "rgba(0,0,0,0.4)",
                  background: active ? "rgba(0,0,0,0.05)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              >
                {item.label}
              </button>
            );
          })}

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.03)", borderRadius: 6, padding: "0 10px", height: 30 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span style={{ fontSize: 13, color: "rgba(0,0,0,0.3)" }}>Søk navn, selskap…</span>
          </div>

          {/* New button */}
          <button style={{ height: 30, padding: "0 12px", borderRadius: 6, fontSize: 13, fontWeight: 500, background: "#111318", color: "#fff", border: "none", cursor: "pointer" }}>
            + Ny kontakt
          </button>
        </div>

        {/* Content */}
        {view === "contacts" ? (
          <div style={{ display: "flex", height: "calc(100vh - 96px)" }}>

            {/* Contact list */}
            <div style={{ width: 420, borderRight: "1px solid rgba(0,0,0,0.06)", overflowY: "auto", background: "#FAFAFA" }}>
              {/* Filter strip */}
              <div style={{ display: "flex", gap: 4, padding: "10px 12px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                {["Alle", "Behov nå", "Fremtidig", "Innkjøper"].map((f, i) => (
                  <span key={f} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: i === 0 ? "#111318" : "transparent", color: i === 0 ? "#fff" : "#71717A", cursor: "pointer", fontWeight: i === 0 ? 500 : 400 }}>{f}</span>
                ))}
              </div>

              {/* List header */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px 4px", fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>Kontakt</span>
                <span>Heat</span>
              </div>

              {contacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    display: "flex", alignItems: "center",
                    minHeight: 52, cursor: "pointer",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    background: selected.id === c.id ? "#FFFFFF" : "transparent",
                    position: "relative",
                    transition: "background 0.07s",
                    padding: "0 16px",
                  }}
                >
                  {/* Heat stripe */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: heatColor[c.heat], borderRadius: "0 2px 2px 0" }} />

                  <div style={{ flex: 1, paddingLeft: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111318" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#71717A" }}>{c.company} · {c.title}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{c.last}</div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: heatColor[c.heat], lineHeight: 1 }}>{c.score}</span>
                    <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: signalStyle[c.signal]?.bg, color: signalStyle[c.signal]?.color, fontWeight: 500 }}>{c.signal}</span>
                  </div>

                  {/* Active indicator */}
                  {selected.id === c.id && (
                    <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, background: "#111318", borderRadius: "2px 0 0 2px" }} />
                  )}
                </div>
              ))}
            </div>

            {/* Detail panel */}
            <div style={{ flex: 1, overflowY: "auto", padding: 0, background: "#fff" }}>

              {/* Header */}
              <div style={{ padding: "24px 32px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #E0E7FF, #C7D2FE)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "#4338CA" }}>
                      {selected.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#111318", lineHeight: 1.2 }}>{selected.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 13, color: "#71717A" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V3a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v4"/></svg>
                        {selected.company}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 13, color: "#71717A", flexWrap: "wrap", alignItems: "center" }}>
                        <span>{selected.title}</span>
                        <span style={{ color: "#D1D5DB" }}>·</span>
                        <span>+47 913 22 401</span>
                        <span style={{ color: "#D1D5DB" }}>·</span>
                        <a href="#" style={{ color: "#0070F3", textDecoration: "none" }}>epost@selskap.no</a>
                      </div>
                    </div>
                  </div>
                  {/* Heat */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: heatColor[selected.heat], lineHeight: 1 }}>{selected.score}</span>
                    <div style={{ width: 48, height: 6, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
                      <div style={{ width: `${selected.score}%`, height: "100%", borderRadius: 3, background: heatColor[selected.heat] }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>Heat</span>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99, background: signalStyle[selected.signal]?.bg, color: signalStyle[selected.signal]?.color, fontWeight: 500 }}>{selected.signal}</span>
                  {["C++", "Embedded", "Linux", "AUTOSAR"].map(t => (
                    <span key={t} style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99, background: "#F4F4F5", color: "#52565E" }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, padding: "16px 32px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexWrap: "wrap" }}>
                {[
                  { label: "Logg samtale", bg: "#16A34A", color: "#fff", border: "none" },
                  { label: "Logg møte", bg: "#0070F3", color: "#fff", border: "none" },
                  { label: "Ny oppfølging", bg: "transparent", color: "#52565E", border: "1px solid rgba(0,0,0,0.12)" },
                  { label: "AI-pitch ✦", bg: "transparent", color: "#0070F3", border: "1px solid #0070F3", marginLeft: "auto" },
                ].map(a => (
                  <button key={a.label} style={{ height: 32, padding: "0 14px", borderRadius: 6, fontSize: 13, fontWeight: 500, background: a.bg, color: a.color, border: a.border || "none", cursor: "pointer", marginLeft: (a as any).marginLeft || undefined }}>{a.label}</button>
                ))}
              </div>

              {/* Two-column body */}
              <div style={{ display: "flex", padding: "0 32px 32px" }}>

                {/* Timeline */}
                <div style={{ flex: 1, paddingTop: 20, paddingRight: 24 }}>
                  {[
                    { group: "Oppfølginger · 1", items: [{ type: "task", title: "Send CV — Håkon Larsen", sub: "C++ embedded · Behov nå", due: "Frist 15. april" }] },
                    { group: "Mars 2025", items: [
                      { type: "call", title: "Ringte — ikke svar", meta: "28. mar · Thomas", signal: "Behov nå" },
                      { type: "meeting", title: "Møtereferat — Q1", meta: "14. mar · Thomas", desc: "Bekreftet behov for 2 senior C++ konsulenter til oppstart august.", signal: "Behov nå" },
                    ]},
                    { group: "Februar 2025", items: [
                      { type: "call", title: "Første samtale — introduksjon", meta: "2. feb · Jon Richard", desc: "Positiv til konsulentleie. Vil kontaktes igjen i mars.", signal: "Fremtidig" },
                    ]},
                  ].map((section, si) => (
                    <div key={si} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#71717A", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{section.group}</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
                      </div>
                      {section.items.map((item: any, ii: number) => (
                        <div key={ii} style={{ marginBottom: 12 }}>
                          {item.type === "task" ? (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", background: "#FAFAFA" }}>
                              <div style={{ width: 16, height: 16, borderRadius: 4, border: "2px solid #D97706", marginTop: 2, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#111318" }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>{item.sub}</div>
                                <div style={{ fontSize: 12, color: "#D97706", fontWeight: 500, marginTop: 2 }}>{item.due}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 12 }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {item.type === "call"
                                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.97.36 1.93.68 2.84a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.87.55 2.84.68A2 2 0 0 1 22 16.92z"/></svg>
                                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0070F3" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  }
                                </div>
                                {(item.desc || ii < section.items.length - 1) ? <div style={{ flex: 1, width: 2, background: "rgba(0,0,0,0.06)", marginTop: 4 }} /> : null}
                              </div>
                              <div style={{ flex: 1, paddingBottom: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: "#111318" }}>{item.title}</span>
                                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{item.meta}</span>
                                </div>
                                {item.desc && <div style={{ fontSize: 13, color: "#52565E", marginTop: 4, lineHeight: 1.5 }}>{item.desc}</div>}
                                {item.signal && (
                                  <div style={{ marginTop: 6 }}>
                                    <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: signalStyle[item.signal]?.bg, color: signalStyle[item.signal]?.color, fontWeight: 500 }}>{item.signal}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Properties sidebar */}
                <div style={{ width: 220, paddingTop: 20, borderLeft: "1px solid rgba(0,0,0,0.06)", paddingLeft: 20 }}>
                  {[
                    { label: "Egenskaper", rows: [
                      { k: "Stilling", v: selected.title },
                      { k: "Telefon", v: "+47 913 22 401" },
                      { k: "Epost", v: "epost@selskap.no", link: true },
                      { k: "LinkedIn", v: "Vis profil ↗", link: true },
                      { k: "Siste kontakt", v: selected.last },
                      { k: "Eier", v: "Thomas Eriksen" },
                    ]},
                    { label: "Selskap", rows: [
                      { k: "Navn", v: selected.company, link: true },
                      { k: "Bransje", v: "Industri / IT" },
                    ]},
                  ].map((section, si) => (
                    <div key={si} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{section.label}</div>
                      {section.rows.map((row: any, ri: number) => (
                        <div key={ri} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{row.k}</span>
                          <span style={{ fontSize: 12, color: row.link ? "#0070F3" : "#111318", fontWeight: 500, cursor: row.link ? "pointer" : undefined }}>{row.v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard view */
          <div style={{ padding: 40 }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111318" }}>God morgen, Thomas 👋</div>
              <div style={{ fontSize: 14, color: "#71717A", marginTop: 4 }}>Her er hva som trenger oppmerksomhet</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Behov nå", value: "4", sub: "Eirik, Mathias +2", color: "#16A34A" },
                { label: "Forfalt", value: "2", sub: "Oppfølginger", color: "#DC2626" },
                { label: "Forespørsler", value: "3", sub: "Kongsberg, Six, Thales", color: "#0070F3" },
                { label: "Kontakter", value: "247", sub: "+3 denne uken", color: "#111318" },
              ].map((k, i) => (
                <div key={i} style={{ padding: 20, borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)", background: "#fff" }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>{k.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
