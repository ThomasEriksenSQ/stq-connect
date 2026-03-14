import { useEffect } from "react";

const SIDEBAR_WIDTH = "55mm";
const SIDEBAR_COLOR = "#000000";
const PHOTO_PLACEHOLDER_COLOR = "#919ca1";

export default function CVMaker() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-styles";
    style.textContent = `
      @media print {
        @page { size: A4; margin: 0; }
        body * { visibility: hidden; }
        .cv-document, .cv-document * { visibility: visible; }
        .cv-document {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 210mm !important;
          margin: 0 !important;
          box-shadow: none !important;
        }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("cv-print-styles");
      if (el) el.remove();
    };
  }, []);

  const sectionHeading = (text: string) => (
    <div
      style={{
        fontWeight: 700,
        fontSize: "11pt",
        textTransform: "uppercase" as const,
        letterSpacing: "0.04em",
        color: "#1a1a1a",
        marginTop: "6mm",
        marginBottom: "1mm",
        paddingBottom: "1mm",
        borderBottom: "1px solid #9c9c9c",
      }}
    >
      {text}
    </div>
  );

  return (
    <div>
      {/* PRINT BUTTON */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => window.print()}
          style={{
            background: "#1a1a1a",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          Last ned / Skriv ut PDF
        </button>
        <span style={{ fontSize: 13, color: "#888" }}>
          Velg «Lagre som PDF» i utskriftsdialogen
        </span>
      </div>

      {/* CV DOCUMENT */}
      <div
        className="cv-document"
        style={
          {
            width: "210mm",
            minHeight: "297mm",
            background: `linear-gradient(to right, ${SIDEBAR_COLOR} ${SIDEBAR_WIDTH}, #ffffff ${SIDEBAR_WIDTH})`,
            fontFamily: "Calibri, Carlito, 'Segoe UI', sans-serif",
            color: "#1a1a1a",
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
            colorAdjust: "exact",
            position: "relative",
            margin: "0 auto",
            boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
          } as React.CSSProperties
        }
      >
        {/* ── TOP HEADER ROW: logo (sidebar) + kontaktperson (main) ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          {/* Logo area — sits on black sidebar */}
          <div
            style={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              padding: "7mm 4mm 0 4mm",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <img
              src="/STACQ_logo.png"
              alt="STACQ logo"
              style={{ height: "8mm", objectFit: "contain", filter: "brightness(0) invert(1)" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          {/* Kontaktperson — top right of main area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "flex-end",
              padding: "7mm 10mm 0 0",
            }}
          >
            <div
              style={{
                textAlign: "right",
                fontSize: "9pt",
                color: "#444",
                lineHeight: 1.7,
                borderLeft: "2px solid #8e8e8e",
                paddingLeft: "3mm",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "9.5pt", color: "#222" }}>
                Kontaktperson
              </div>
              <div>Jon Richard Nygaard</div>
              <div style={{ fontSize: "8pt", color: "#888" }}>
                932 87 267 / jr@stacq.no
              </div>
            </div>
          </div>
        </div>

        {/* ── PHOTO + NAME AREA ── */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {/* Sidebar photo placeholder */}
          <div
            style={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              padding: "4mm 3mm 0 3mm",
            }}
          >
            <div
              style={{
                width: "48mm",
                height: "48mm",
                borderRadius: "2mm",
                background: PHOTO_PLACEHOLDER_COLOR,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Photo placeholder */}
            </div>
          </div>

          {/* Name + tagline */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* NAME — light gray background */}
            <div style={{ background: "#f2f2f2", padding: "5mm 10mm 4mm 6mm" }}>
              <div
                style={{
                  fontSize: "28pt",
                  fontWeight: 700,
                  color: "#1a1a1a",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                Mattis Spieler Asp
              </div>
            </div>

            {/* TAGLINE — white background, below name */}
            <div
              style={{
                padding: "3mm 10mm 2mm 6mm",
                fontSize: "12pt",
                color: "#444",
                fontWeight: 400,
              }}
            >
              Senior Embedded-ingeniør med 8 års erfaring
            </div>
          </div>
        </div>

        {/* ── BODY: sidebar text + main content ── */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {/* SIDEBAR TEXT */}
          <div
            style={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              padding: "5mm 4mm 10mm 4mm",
              color: "rgba(255,255,255,0.85)",
              fontSize: "8pt",
              lineHeight: 1.6,
            }}
          >
            {(
              [
                {
                  heading: "Personalia",
                  items: [
                    "Født 1990",
                    "Norsk, morsmål",
                    "Engelsk, flytende",
                    "Norsk statsborger",
                    "Kan sikkerhetsklareres",
                  ],
                },
                {
                  heading: "Nøkkelpunkter",
                  items: [
                    "C, C++, Python, QT",
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
              ] as { heading: string; items: string[] }[]
            ).map((section) => (
              <div key={section.heading} style={{ marginBottom: "4mm" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "8pt",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "1.5mm",
                    color: "#fff",
                  }}
                >
                  {section.heading}
                </div>
                {section.items.map((item) => (
                  <div
                    key={item}
                    style={{ display: "flex", gap: "1.5mm", marginBottom: "0.5mm" }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* MAIN CONTENT */}
          <div
            style={{
              flex: 1,
              padding: "5mm 10mm 10mm 6mm",
              fontSize: "9pt",
              lineHeight: 1.7,
              color: "#222",
            }}
          >
            {/* Bio paragraphs */}
            {[
              "Mattis har solid og bred erfaring med utvikling av sikkerhetskritiske embedded-løsninger, inkludert design av kretskort, systemarkitektur, firmware og GUI-applikasjoner. Han har jobbet både som tech lead, senior utvikler, og CTO og kombinert teknisk ledelse med dyp utviklingskompetanse i komplekse og regulatoriske prosjekter.",
              "Hans kjernekompetanse inkluderer kretskortdesign, C/C++, Qt, Python, elektronikk og kommunikasjonsprotokoller som BLE, LoRa, RFID og NFC. Han har også solid erfaring med kvalitetssikring i produksjon – fra testoppsett til ferdig sammenstilling – og med regulatorisk dokumentasjon for CE-godkjenning i Europa og FDA i USA.",
              "Mattis har arbeidet med sensorteknologier som akselerometer, gyro, ultralyd, kjemiske målere og optikk, og samarbeidet med en rekke selskaper i både Norge og internasjonalt.",
              "Han er kjent for å være en løsningsorientert, kunnskapsrik og samarbeidsvillig kollega med høy teknologisk integritet og sterk gjennomføringsevne. Mattis er lett å jobbe med i team, og bidrar aktivt til godt samarbeid og teknisk kvalitet.",
            ].map((text, i) => (
              <p key={i} style={{ marginBottom: "2mm" }}>
                {text}
              </p>
            ))}

            {/* Competence lines */}
            {[
              [
                "Programmeringsspråk og verktøy",
                "C, C++, Python, Qt, Matlab, Bash, Go, VHDL, Assembly, (Perl, JavaScript, HTML, PHP)",
              ],
              [
                "Embedded-teknologier",
                "Embedded Linux, Yocto, U-Boot, RTOS, bootloader, core split, mikrokontrollere",
              ],
              [
                "Hardware og utviklingsverktøy",
                "PCB-design (Altium, KiCAD, Eagle), FPGA, layout og skjematikk, debugging, oscilloskop, logikkanalysator, spektrumanalysator",
              ],
              [
                "Kommunikasjon og protokoller",
                "BLE, LoRa, RFID, NFC, I²C/TWI, SPI, RS232, RS485, HDMI, TCP, UDP, SSH, SCP, UART, USART",
              ],
              [
                "DevOps og testing",
                "CI/CD, Jenkins, Docker, GTest, PyTest, testdrevet utvikling, crosskompilering, board bringup, funksjonell testing",
              ],
              [
                "Regulatorisk og ledelse",
                "ISO/IEC 60601, 13485, 62304, 14971, CE/FDA-godkjenning, medisinteknisk utvikling, prosjektledelse, risikohåndtering",
              ],
            ].map(([label, content]) => (
              <div key={label} style={{ marginBottom: "1mm", fontSize: "8.5pt" }}>
                <strong>{label}:</strong> {content}
              </div>
            ))}

            {/* PROSJEKTER */}
            {sectionHeading("Prosjekter")}

            {(
              [
                {
                  company: "Respinor AS",
                  subtitle:
                    "Utvikling av ultralydsensor for respiratorpasienter",
                  role: "Tech Lead, Senior Software Engineer og CTO",
                  periode: "6/24–6/25",
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
                  periode: "1/23–4/23",
                  desc: [
                    "Cardiaccs ønsket å utvide produktgruppen og utvikle alternativer til direkte tilkobling til strømkilde som ble erstattet med energihøsting og NFC. Mattis utviklet PCB og produserte dette på fleksibel PCB med tilhørende komponenter.",
                  ],
                  tech: "Fleksibel PCB, C++, Arduino, NFC, energy harvesting, driverutvikling, prototyping, patentering.",
                },
                {
                  company: "Cardiaccs AS",
                  subtitle: "Utvikling av smart pacemakertråd",
                  role: "Tech Lead, Senior Software Engineer og CTO",
                  periode: "1/22–5/24",
                  desc: [
                    "Cardiaccs er et unikt norsk medisinsk selskap som utvikler den første smarte pacemakertråden for implantering på hjerte under hjertekirurgi og gir kontinuerlig overvåkning av pasienten etter operasjon.",
                    "Mattis startet i Cardiaccs som software utvikler med formål om å utvikle drivere og jobbe med Yocto + QT.",
                  ],
                  tech: "C++, Python, Yocto, Qt, CMake, GTest, sanntidsdatabehandling, signalbehandling.",
                },
              ] as {
                company: string;
                subtitle: string;
                role: string;
                periode: string;
                desc: string[];
                tech: string;
              }[]
            ).map((project) => (
              <div
                key={project.company + project.periode}
                style={{
                  marginBottom: "4mm",
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "10pt",
                    color: "#111",
                    letterSpacing: "0.02em",
                  }}
                >
                  {project.company}
                </div>
                <div
                  style={{
                    fontSize: "9pt",
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "0.5mm",
                  }}
                >
                  {project.subtitle}
                </div>
                <div
                  style={{
                    fontSize: "8pt",
                    color: "#888",
                    marginBottom: "1.5mm",
                  }}
                >
                  <span>Rolle: {project.role}</span>
                  <span style={{ marginLeft: "4mm" }}>
                    Periode: {project.periode}
                  </span>
                </div>
                {project.desc.map((d, i) => (
                  <p
                    key={i}
                    style={{
                      marginBottom: "1.5mm",
                      fontSize: "8.5pt",
                      lineHeight: 1.65,
                    }}
                  >
                    {d}
                  </p>
                ))}
                <div style={{ fontSize: "8pt", color: "#666", marginTop: "1mm" }}>
                  <strong>Teknologier:</strong> {project.tech}
                </div>
              </div>
            ))}

            {/* UTDANNELSE */}
            {sectionHeading("Utdannelse")}
            <div style={{ fontSize: "9pt", marginBottom: "4mm" }}>
              <span style={{ fontWeight: 600 }}>2011 – 2017</span>
              <span style={{ marginLeft: "3mm" }}>
                Master i elektronikk fra NTNU, med spesialisering i innvevde
                systemer
              </span>
            </div>

            {/* ARBEIDSERFARING */}
            {sectionHeading("Arbeidserfaring")}
            {(
              [
                ["2025 –", "STACQ AS"],
                ["2024 – 2025", "RESPINOR AS"],
                ["2022 – 2024", "Cardiaccs AS"],
                ["2017 – 2022", "Glucoset AS"],
              ] as [string, string][]
            ).map(([year, company]) => (
              <div
                key={year}
                style={{
                  fontSize: "9pt",
                  marginBottom: "1mm",
                  display: "flex",
                  gap: "3mm",
                }}
              >
                <span style={{ fontWeight: 600, minWidth: "25mm" }}>{year}</span>
                <span>{company}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
