import { useEffect } from "react";

export default function CVMaker() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-styles";
    style.textContent = `
      @media print {
        @page { size: A4; margin: 0; }
        body * { visibility: hidden; }
        .cv-document, .cv-document * { visibility: visible; }
        .cv-document { position: fixed; top: 0; left: 0; width: 210mm; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("cv-print-styles");
      if (el) el.remove();
    };
  }, []);

  return (
    <div>
      {/* PRINT BUTTON */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => window.print()}
          style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em" }}
        >
          Last ned / Skriv ut PDF
        </button>
        <span style={{ fontSize: 13, color: "#888" }}>Velg «Lagre som PDF» i utskriftsdialogen</span>
      </div>

      {/* CV DOCUMENT */}
      <div
        className="cv-document"
        style={{
          width: "210mm",
          minHeight: "100%",
          background: "linear-gradient(to right, #111 165px, #fff 165px)",
          overflow: "hidden",
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          color: "#1a1a1a",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
          position: "relative",
          margin: "0 auto",
          boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
        } as React.CSSProperties}
      >
        {/* PAGE 1 HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 40px 20px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#4fc3f7" }} />
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#e0e0e0" }} />
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#e0e0e0" }} />
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.04em", marginLeft: 6, color: "#fff" }}>STACQ</span>
            </div>
          </div>

          <div style={{ textAlign: "right", fontSize: 12, color: "#444", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#222" }}>Kontaktperson</div>
            <div>Jon Richard Nygaard</div>
            <div style={{ fontSize: 11, color: "#888" }}>932 87 267 / jr@stacq.no</div>
          </div>
        </div>

        {/* NAME BAND */}
        <div style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)", padding: "28px 40px 24px 28px", marginLeft: 165, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ color: "#fff", fontSize: "40pt", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            Mattis Spieler Asp
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "14pt", fontWeight: 400, flexShrink: 0, marginLeft: "8mm", marginBottom: "2mm" }}>
            Senior Embedded-ingeniør med 8 års erfaring
          </div>
        </div>

        {/* BODY */}
        <div style={{ display: "flex", minHeight: "calc(297mm - 160px)" }}>
          {/* SIDEBAR */}
          <div style={{ width: 165, flexShrink: 0, padding: "24px 16px 24px 16px", color: "rgba(255,255,255,0.85)", fontSize: 11, lineHeight: 1.6 }}>
            {[
              {
                heading: "Personalia",
                items: ["Født 1990", "Norsk, morsmål", "Engelsk, flytende", "Norsk statsborger", "Kan sikkerhetsklareres"],
              },
              {
                heading: "Nøkkelpunkter",
                items: ["C, C++, Python, QT", "Embedded Linux, Yocto, U-Boot, core split", "Mikrokontrollere", "Sanntidssystemer", "BLE, LoRa, RFID, NFC", "CI/CD, funksjonell testing", "Layout og skjematikk", "Altium, KiCAD, Eagle", "Project management", "Design control, Quality in production", "Patent experience", "Soft funding applications", "Medical Device regulations, ISO/IEC 9001"],
              },
              {
                heading: "Utdannelse",
                items: ["MSc. Innvevde Systemer, NTNU"],
              },
            ].map((section) => (
              <div key={section.heading} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, color: "#fff" }}>
                  {section.heading}
                </div>
                {section.items.map((item) => (
                  <div key={item} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, padding: "28px 40px 40px 28px", fontSize: 12, lineHeight: 1.7, color: "#222" }}>
            {["Mattis har solid og bred erfaring med utvikling av sikkerhetskritiske embedded-løsninger, inkludert design av kretskort, systemarkitektur, firmware og GUI-applikasjoner. Han har jobbet både som tech lead, senior utvikler, og CTO og kombinert teknisk ledelse med dyp utviklingskompetanse i komplekse og regulatoriske prosjekter.",
              "Hans kjernekompetanse inkluderer kretskortdesign, C/C++, Qt, Python, elektronikk og kommunikasjonsprotokoller som BLE, LoRa, RFID og NFC. Han har også solid erfaring med kvalitetssikring i produksjon – fra testoppsett til ferdig sammenstilling – og med regulatorisk dokumentasjon for CE-godkjenning i Europa og FDA i USA.",
              "Han er kjent for å være en løsningsorientert, kunnskapsrik og samarbeidsvillig kollega med høy teknologisk integritet og sterk gjennomføringsevne.",
            ].map((text, i) => (
              <p key={i} style={{ marginBottom: 10 }}>{text}</p>
            ))}

            {[
              ["Programmeringsspråk og verktøy", "C, C++, Python, Qt, Matlab, Bash, Go, VHDL, Assembly, (Perl, JavaScript, HTML, PHP)"],
              ["Embedded-teknologier", "Embedded Linux, Yocto, U-Boot, RTOS, bootloader, core split, mikrokontrollere"],
              ["Hardware og utviklingsverktøy", "PCB-design (Altium, KiCAD, Eagle), FPGA, layout og skjematikk, debugging, oscilloskop, logikkanalysator, spektrumanalysator"],
              ["Kommunikasjon og protokoller", "BLE, LoRa, RFID, NFC, I²C/TWI, SPI, RS232, RS485, HDMI, TCP, UDP, SSH, SCP, UART, USART"],
              ["DevOps og testing", "CI/CD, Jenkins, Docker, GTest, PyTest, testdrevet utvikling, crosskompilering, board bringup, funksjonell testing"],
              ["Regulatorisk og ledelse", "ISO/IEC 60601, 13485, 62304, 14971, CE/FDA-godkjenning, medisinteknisk utvikling, prosjektledelse, risikohåndtering"],
            ].map(([label, content]) => (
              <div key={label} style={{ marginBottom: 4, fontSize: 11 }}>
                <strong>{label}:</strong> {content}
              </div>
            ))}

            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 28, marginBottom: 12, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
              Prosjekter
            </div>

            {[
              {
                company: "RESPINOR AS",
                subtitle: "Utvikling av ultralydsensor for respiratorpasienter",
                role: "Tech Lead, Senior Software Engineer og CTO",
                periode: "6/24–6/25",
                desc: ["RESPINOR AS er et norsk medisinsk selskap som revolusjonerer overvåkning av pasienter på respirator.", "Hos RESPINOR jobbet Mattis som senior utvikler og CTO i en avgjørende regulatorisk og teknisk fase av prosjektet. Der han satte opp prosjektplan for arbeidet, analyserte svakheter og mangler i produktet, f.eks regulatorisk, verifikasjon og teknisk, cost analyse, ytterligere funksjoner i produkt, og plan for produksjon."],
                tech: "Ultralyd, accelerometer, gyroskop, RS485, I2C, Yocto, embedded C, C++, Altium, BOM management, produksjonsteknikkk.",
              },
              {
                company: "CARDIACCS AS",
                subtitle: "NFC og energy harvesting application",
                role: "Tech Lead, Senior Software Engineer og CTO",
                periode: "1/23–4/23",
                desc: ["Cardiaccs ønsket å utvide produktgruppen og utvikle alternativer til direkte tilkobling til strømkilde som ble erstattet med energihøsting og NFC. Mattis utviklet PCB og produserte dette på fleksibel PCB med tilhørende komponenter."],
                tech: "Fleksibel PCB, C++, Arduino, NFC, energy harvesting, driverutvikling, prototyping, patentering.",
              },
              {
                company: "CARDIACCS AS",
                subtitle: "Utvikling av smart pacemakertråd",
                role: "Tech Lead, Senior Software Engineer og CTO",
                periode: "1/22–5/24",
                desc: ["Cardiaccs er et unikt norsk medisinsk selskap som utvikler den første smarte pacemakertråden for implantering på hjerte under hjertekirurgi og gir kontinuerlig overvåkning av pasienten etter operasjon.", "Mattis startet i Cardiaccs som software utvikler med formål om å utvikle drivere og jobbe med Yocto + QT."],
                tech: "C++, Python, Yocto, Qt, CMake, GTest, sanntidsdatabehandling, signalbehandling.",
              },
            ].map((project) => (
              <div key={project.company + project.periode} style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#111", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {project.company}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 2 }}>
                  {project.subtitle}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                  <span>Rolle: {project.role}</span>
                  <span style={{ marginLeft: 16 }}>Periode: {project.periode}</span>
                </div>
                {project.desc.map((d, i) => (
                  <p key={i} style={{ marginBottom: 6, fontSize: 11, lineHeight: 1.65 }}>{d}</p>
                ))}
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  <strong>Teknologier:</strong> {project.tech}
                </div>
              </div>
            ))}

            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 24, marginBottom: 8, textTransform: "uppercase" }}>
              Utdannelse
            </div>
            <div style={{ fontSize: 11, marginBottom: 16 }}>
              <span style={{ fontWeight: 600 }}>2011 – 2017</span>
              <span style={{ marginLeft: 12 }}>Master i elektronikk fra NTNU, med spesialisering i innvevde systemer</span>
            </div>

            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 16, marginBottom: 8, textTransform: "uppercase" }}>
              Arbeidserfaring
            </div>
            {[["2025 –", "STACQ AS"], ["2024 – 2025", "RESPINOR AS"], ["2022 – 2024", "Cardiaccs AS"], ["2017 – 2022", "Glucoset AS"]].map(([year, company]) => (
              <div key={year} style={{ fontSize: 11, marginBottom: 4, display: "flex", gap: 12 }}>
                <span style={{ fontWeight: 600, minWidth: 90 }}>{year}</span>
                <span>{company}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
