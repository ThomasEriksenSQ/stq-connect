import { useEffect } from "react";

const SIDEBAR_W = "55mm";

export default function CVMaker() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-styles";
    style.textContent = `
      @media print {
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
        }
        body > * {
          display: none !important;
        }
        .cv-print-root {
          display: block !important;
        }
        .no-print {
          display: none !important;
        }
        .cv-document {
          width: 210mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          page-break-inside: auto;
        }
        .cv-project-block {
          page-break-inside: avoid;
          break-inside: avoid;
        }
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
      <div
        className="no-print"
        style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}
      >
        <button
          onClick={() => window.print()}
          style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em" }}
        >
          Last ned / Skriv ut PDF
        </button>
        <span style={{ fontSize: 13, color: "#888" }}>
          Velg «Lagre som PDF» i utskriftsdialogen. Skru av topp-/bunntekst i utskriftsinnstillinger.
        </span>
      </div>

      {/* cv-print-root for print isolation */}
      <div className="cv-print-root">
        <div
          className="cv-document"
          style={{
            width: "210mm",
            minHeight: "297mm",
            background: `linear-gradient(to right, #000000 ${SIDEBAR_W}, #ffffff ${SIDEBAR_W})`,
            fontFamily: "Calibri, Carlito, 'Segoe UI', sans-serif",
            color: "#1a1a1a",
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
            colorAdjust: "exact",
            position: "relative",
            margin: "0 auto",
            boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
          } as React.CSSProperties}
        >
          {/* ROW 1: LOGO + KONTAKTPERSON */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            {/* LOGO */}
            <div style={{ width: SIDEBAR_W, flexShrink: 0, padding: "9mm 4mm 0 4mm", display: "flex", justifyContent: "center" }}>
              <img
                src="/STACQ_logo.png"
                alt="STACQ logo"
                style={{ height: "9mm", objectFit: "contain", filter: "brightness(0) invert(1)" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector("svg")) {
                    const ns = "http://www.w3.org/2000/svg";
                    const svg = document.createElementNS(ns, "svg");
                    svg.setAttribute("width", "110"); svg.setAttribute("height", "30"); svg.setAttribute("viewBox", "0 0 110 30");
                    svg.innerHTML = `<text x="0" y="24" fill="white" font-size="28" font-weight="bold" font-family="Calibri,sans-serif">STACQ</text>`;
                    parent.appendChild(svg);
                  }
                }}
              />
            </div>

            {/* KONTAKTPERSON */}
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", padding: "9mm 10mm 0 0" }}>
              <div style={{ textAlign: "right", fontSize: "9pt", color: "#444", lineHeight: 1.7, borderLeft: "2px solid #8e8e8e", paddingLeft: "3mm" }}>
                <div style={{ fontWeight: 600, fontSize: "9.5pt", color: "#222" }}>Kontaktperson</div>
                <div>Jon Richard Nygaard</div>
                <div style={{ fontSize: "8pt", color: "#888" }}>932 87 267 / jr@stacq.no</div>
              </div>
            </div>
          </div>

          {/* ROW 2: PHOTO + NAME BAND */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {/* SIDEBAR PHOTO */}
            <div style={{ width: SIDEBAR_W, flexShrink: 0, display: "flex", justifyContent: "center", padding: "4mm 3mm 0 3mm" }}>
              <img
                src="/cv-photos/mattis.png"
                alt="Mattis Spieler Asp"
                style={{
                  width: "48mm",
                  height: "54mm",
                  borderRadius: "2mm",
                  objectFit: "cover",
                  objectPosition: "center top",
                  background: "#919ca1",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const d = document.createElement("div");
                  d.style.cssText = `width:100%;height:54mm;background:#919ca1;display:block;border-radius:2mm;`;
                  e.currentTarget.parentElement?.appendChild(d);
                }}
              />
            </div>

            {/* MAIN: white spacer + gray name band */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* WHITE SPACER: 13.5mm pushes gray band to y=31.5mm */}
              <div style={{ height: "13.5mm" }} />

              {/* GRAY NAME BAND: 34mm total */}
              <div style={{ background: "#f2f2f2", minHeight: "34mm", padding: "1.5mm 10mm 6.5mm 6mm", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                <div style={{ fontSize: "43pt", fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                  Mattis Spieler Asp
                </div>
                <div style={{ marginTop: "10mm", fontSize: "12pt", color: "#444", fontWeight: 400, letterSpacing: "0.02em" }}>
                  Senior Embedded-ingeniør med 8 års erfaring
                </div>
              </div>

              {/* Fill remaining white space */}
              <div style={{ height: "4mm" }} />
            </div>
          </div>

          {/* ROW 3: BODY — sidebar text + main content */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {/* SIDEBAR TEXT */}
            <div style={{ width: SIDEBAR_W, flexShrink: 0, padding: "5mm 4mm 10mm 4mm", color: "rgba(255,255,255,0.85)", fontSize: "8pt", lineHeight: 1.6 }}>
              {([
                {
                  heading: "Personalia",
                  items: ["Født 1990", "Norsk, morsmål", "Engelsk, flytende", "Norsk statsborger", "Kan sikkerhetsklareres"],
                },
                {
                  heading: "Nøkkelpunkter",
                  items: [
                    "C,C++, Python, QT",
                    "Embedded Linux, Yocto, U-Boot, core split",
                    "Mikrokontrollere",
                    "Sanntidssystemer",
                    "BLE, LoRa, RFID, NFC",
                    "CI/CD, funksjonell testing",
                    "Layout og skjematikk",
                    "Altium, KiCAD, Eagle",
                    "Project management",
                    "Design control, Quality in production",
                    "Patent experience",
                    "Soft funding applications",
                    "Medical Device regulations, ISO/IEC 9001",
                  ],
                },
                {
                  heading: "Utdannelse",
                  items: ["MSc. Innvevde Systemer, NTNU"],
                },
              ] as { heading: string; items: string[] }[]).map((section) => (
                <div key={section.heading} style={{ marginBottom: "4mm" }}>
                  <div style={{ fontWeight: 700, fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.5mm", color: "#fff" }}>
                    {section.heading}
                  </div>
                  {section.items.map((item) => (
                    <div key={item} style={{ display: "flex", gap: "1.5mm", marginBottom: "0.5mm" }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, padding: "5mm 9mm 10mm 7mm", fontSize: "10pt", lineHeight: 1.9, color: "#222" }}>
              {/* Bio */}
              {[
                "Mattis har solid og bred erfaring med utvikling av sikkerhetskritiske embedded-løsninger, inkludert design av kretskort, systemarkitektur, firmware og GUI-applikasjoner. Han har jobbet både som tech lead, senior utvikler, og CTO og kombinert teknisk ledelse med dyp utviklingskompetanse i komplekse og regulatoriske prosjekter.",
                "Hans kjernekompetanse inkluderer kretskortdesign, C/C++, Qt, Python, elektronikk og kommunikasjonsprotokoller som BLE, LoRa, RFID og NFC. Han har også solid erfaring med kvalitetssikring i produksjon – fra testoppsett til ferdig sammenstilling – og med regulatorisk dokumentasjon for CE-godkjenning i Europa og FDA i USA.",
                "Mattis har arbeidet med sensorteknologier som akselerometer, gyro, ultralyd, kjemiske målere og optikk, og samarbeidet med en rekke selskaper i både Norge og internasjonalt. Han har presentert for og oppnådd støtte fra European Innovation Council (Seal of Excellence) og vunnet Venture Cup for innovativ Bluetooth-teknologi.",
                "Han er kjent for å være en løsningsorientert, kunnskapsrik og samarbeidsvillig kollega med høy teknologisk integritet og sterk gjennomføringsevne. Mattis er lett å jobbe med i team, og bidrar aktivt til godt samarbeid og teknisk kvalitet.",
              ].map((text, i) => (
                <p key={i} style={{ marginBottom: "3.5mm" }}>{text}</p>
              ))}

              {/* Competence lines */}
              <div style={{ marginTop: "2mm", marginBottom: "2mm" }}>
                {[
                  ["Programmeringsspråk og verktøy", "C, C++, Python, Qt, Matlab, Bash, Go, VHDL, Assembly, (Perl, JavaScript, HTML, PHP)"],
                  ["Embedded-teknologier", "Embedded Linux, Yocto, U-Boot, RTOS, bootloader, core split, mikrokontrollere"],
                  ["Hardware og utviklingsverktøy", "PCB-design (Altium, KiCAD, Eagle), FPGA, layout og skjematikk, debugging, oscilloskop, logikkanalysator, spektrumanalysator"],
                  ["Kommunikasjon og protokoller", "BLE, LoRa, RFID, NFC, I²C/TWI, SPI, RS232, RS485, HDMI, TCP, UDP, SSH, SCP, UART, USART"],
                  ["DevOps og testing", "CI/CD, Jenkins, Docker, GTest, PyTest, testdrevet utvikling, crosskompilering, board bringup, funksjonell testing"],
                  ["Regulatorisk og ledelse", "ISO/IEC 60601, 13485, 62304, 14971, CE/FDA-godkjenning, medisinteknisk utvikling, prosjektledelse, risikohåndtering"],
                ].map(([label, content]) => (
                  <div key={label} style={{ marginBottom: "1mm", fontSize: "9pt" }}>
                    <strong>{label}:</strong> {content}
                  </div>
                ))}
              </div>

              {/* PROSJEKTER */}
              <div style={{ fontWeight: 700, fontSize: "11pt", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", marginTop: "6mm", marginBottom: "1mm", paddingBottom: "1mm", borderBottom: "1px solid #9c9c9c" }}>
                Prosjekter
              </div>

              {([
                {
                  company: "Respinor AS",
                  subtitle: "Utvikling av ultralydsensor for respiratorpasienter",
                  role: "Tech Lead, Senior Software Engineer og CTO",
                  periode: "6/24-6/25",
                  desc: [
                    "RESPINOR AS er et norsk medisinsk selskap som revolusjonerer overvåkning av pasienter på respirator.",
                    "Hos RESPINOR jobbet Mattis som senior utvikler og CTO i en avgjørende regulatorisk og teknisk fase av prosjektet. Der han satte opp prosjektplan for arbeidet, analyserte svakheter og mangler i produktet, f.eks regulatorisk, verifikasjon og teknisk, cost analyse, ytterligere funksjoner i produkt, og plan for produksjon.",
                  ],
                  tech: "Ultralyd, accelerometer, gyroskop, RS485, I2C, Yocto, embedded C, C++, Altium, BOM management, produksjonsteknikkk.",
                },
                {
                  company: "Cardiaccs AS",
                  subtitle: "NFC og energy harvesting application",
                  role: "Tech Lead, Senior Software Engineer og CTO",
                  periode: "1/23-4/23",
                  desc: ["Cardiaccs ønsket å utvide produktgruppen og utvikle alternativer til direkte tilkobling til strømkilde som ble erstattet med energihøsting og NFC. Mattis utviklet PCB og produserte dette på fleksibel PCB med tilhørende komponenter."],
                  tech: "Fleksibel PCB, C++, Arduino, NFC, energy harvesting, driverutvikling, prototyping, patentering.",
                },
                {
                  company: "Cardiaccs AS",
                  subtitle: "Utvikling av smart pacemakertråd",
                  role: "Tech Lead, Senior Software Engineer og CTO",
                  periode: "1/22-5/24",
                  desc: [
                    "Cardiaccs er et unikt norsk medisinsk selskap som utvikler den første smarte pacemakertråden for implantering på hjerte under hjertekirurgi og gir kontinuerlig overvåkning av pasienten etter operasjon.",
                    "Mattis startet i Cardiaccs som software utvikler med formål om å utvikle drivere og jobbe med Yocto + QT.",
                  ],
                  tech: "C++, Python, Yocto, Qt, CMake, GTest, sanntidsdatabehandling, signalbehandling.",
                },
              ] as { company: string; subtitle: string; role: string; periode: string; desc: string[]; tech: string }[]).map((project) => (
                <div key={project.company + project.periode} className="cv-project-block" style={{ marginBottom: "4mm" }}>
                  <div style={{ fontWeight: 700, fontSize: "10pt", color: "#111", letterSpacing: "0.02em" }}>
                    {project.company}
                  </div>
                  <div style={{ fontSize: "9pt", fontWeight: 600, color: "#333", marginBottom: "0.5mm" }}>
                    {project.subtitle}
                  </div>
                  <div style={{ fontSize: "8pt", color: "#888", marginBottom: "1.5mm" }}>
                    <span>Rolle: {project.role}</span>
                    <span style={{ marginLeft: "4mm" }}>Periode: {project.periode}</span>
                  </div>
                  {project.desc.map((d, i) => (
                    <p key={i} style={{ marginBottom: "1.5mm", fontSize: "9pt", lineHeight: 1.65 }}>{d}</p>
                  ))}
                  <div style={{ fontSize: "8pt", color: "#666", marginTop: "1mm" }}>
                    <strong>Teknologier:</strong> {project.tech}
                  </div>
                </div>
              ))}

              {/* UTDANNELSE */}
              <div style={{ fontWeight: 700, fontSize: "11pt", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", marginTop: "6mm", marginBottom: "1mm", paddingBottom: "1mm", borderBottom: "1px solid #9c9c9c" }}>
                Utdannelse
              </div>
              <div style={{ fontSize: "9pt", marginBottom: "4mm" }}>
                <span style={{ fontWeight: 600 }}>2011 – 2017</span>
                <span style={{ marginLeft: "3mm" }}>Master i elektronikk fra NTNU, med spesialisering i innvevde systemer</span>
              </div>

              {/* ARBEIDSERFARING */}
              <div style={{ fontWeight: 700, fontSize: "11pt", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1a1a1a", marginTop: "6mm", marginBottom: "1mm", paddingBottom: "1mm", borderBottom: "1px solid #9c9c9c" }}>
                Arbeidserfaring
              </div>
              {([
                ["2025 –", "STACQ AS"],
                ["2024 – 2025", "RESPINOR AS"],
                ["2022 – 2024", "Cardiaccs AS"],
                ["2017 – 2022", "Glucoset AS"],
              ] as [string, string][]).map(([year, company]) => (
                <div key={year} style={{ fontSize: "9pt", marginBottom: "1mm", display: "flex", gap: "3mm" }}>
                  <span style={{ fontWeight: 600, minWidth: "25mm" }}>{year}</span>
                  <span>{company}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
