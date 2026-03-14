import { useEffect } from "react";
import html2pdf from 'html2pdf.js';

declare module 'html2pdf.js';

export default function CVMaker() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-styles";
    style.textContent = `
      @media print {
        @page { size: A4; margin: 0; }
        body { margin: 0 !important; padding: 0 !important; }
        body > * { display: none !important; }
        .cv-print-root { display: block !important; }
        .no-print { display: none !important; }
        .cv-document { width: 210mm !important; margin: 0 !important; box-shadow: none !important; }
        .cv-project-block { page-break-inside: avoid; break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById("cv-print-styles");
      if (el) el.remove();
    };
  }, []);

  return (
    <div style={{ background: "#d0d0d0", minHeight: "100vh", padding: "24px 0" }}>
      <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 20px auto", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => {
            const element = document.querySelector('.cv-document') as HTMLElement;
            if (!element) return;
            const opt = {
              margin: 0,
              filename: 'Mattis_Spieler_Asp_CV.pdf',
              image: { type: 'jpeg' as const, quality: 0.98 },
              html2canvas: { 
                scale: 2, 
                useCORS: true,
                letterRendering: true,
                width: 794
              },
              jsPDF: { 
                unit: 'mm' as const, 
                format: 'a4' as const, 
                orientation: 'portrait' as const
              }
            };
            html2pdf().set(opt).from(element).save();
          }}
          style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Last ned PDF
        </button>
      </div>

      <div className="cv-print-root">
        <div
          className="cv-document"
          style={{
            width: "210mm",
            minHeight: "297mm",
            margin: "0 auto",
            padding: 0,
            fontFamily: "Calibri, Carlito, Arial, sans-serif",
            color: "#1a1a1a",
            position: "relative",
            background: "#ffffff",
            boxShadow: "0 4px 32px rgba(0,0,0,0.20)",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
            colorAdjust: "exact",
            overflow: "hidden",
          } as React.CSSProperties}
        >

          {/* BLACK SIDEBAR — full document height */}
          <div style={{
            position: "absolute",
            top: 0, left: 0,
            width: "55mm", bottom: 0,
            background: "#000000",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
            colorAdjust: "exact",
          } as React.CSSProperties} />

          {/* HEADER ZONE — 71.4mm tall */}
          <div style={{ position: "relative", height: "71.4mm" }}>

            {/* LOGO */}
            <div style={{ position: "absolute", top: "9.3mm", left: "4mm", zIndex: 10 }}>
              <img
                src="/STACQ_logo.png"
                alt="STACQ"
                style={{ height: "9mm", width: "auto", display: "block", filter: "brightness(0) invert(1)" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector("svg")) {
                    const ns = "http://www.w3.org/2000/svg";
                    const svg = document.createElementNS(ns, "svg");
                    svg.setAttribute("viewBox", "0 0 111 28");
                    svg.style.cssText = "height:9mm;width:auto;display:block;";
                    svg.innerHTML = `<polygon points="14,2 24,8 14,14" fill="white"/><polygon points="4,8 14,14 4,20" fill="white"/><polygon points="14,14 24,20 14,26" fill="white"/><text x="30" y="20" font-family="Calibri,Arial,sans-serif" font-size="16" font-weight="bold" fill="white">STACQ</text>`;
                    parent.appendChild(svg);
                  }
                }}
              />
            </div>

            {/* KONTAKTPERSON */}
            <div style={{ position: "absolute", top: "9.3mm", right: "8mm", zIndex: 10 }}>
              <div style={{ borderLeft: "2px solid #cccccc", paddingLeft: "3mm", fontSize: "9pt", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: "#111111", fontSize: "9.5pt" }}>Kontaktperson</div>
                <div style={{ color: "#444444" }}>Jon Richard Nygaard</div>
                <div style={{ color: "#888888", fontSize: "8.5pt" }}>932 87 267 / jr@stacq.no</div>
              </div>
            </div>

            {/* GRAY BAND — full width, top=31.2mm, height=34.3mm, zIndex=2 */}
            <div style={{
              position: "absolute",
              top: "31.2mm", left: 0, right: 0,
              height: "34.3mm",
              background: "#f2f2f2",
              zIndex: 2,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
              colorAdjust: "exact",
            } as React.CSSProperties}>
              <div style={{
                marginLeft: "55mm",
                paddingLeft: "12.8mm",
                paddingRight: "8.2mm",
                paddingTop: "9.6mm",
                paddingBottom: "5.8mm",
                boxSizing: "border-box" as const,
              }}>
                <div style={{ fontSize: "46pt", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em", lineHeight: 1.0, marginBottom: "3mm" }}>
                  Mattis Spieler Asp
                </div>
                <div style={{ fontSize: "19pt", fontWeight: 400, color: "#1a1a1a", letterSpacing: "0.12em", lineHeight: 1.0 }}>
                  Senior Embedded-ingeniør med 8 års erfaring
                </div>
              </div>
            </div>

            {/* PHOTO — top=25.4mm, full sidebar width, zIndex=3 (above gray band) */}
            <div style={{ position: "absolute", top: "25.4mm", left: 0, width: "55mm", height: "46mm", zIndex: 3, overflow: "hidden" }}>
              <img
                src="/Mattis_CV.png"
                alt="Mattis Spieler Asp"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block", borderRadius: 0 }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const d = document.createElement("div");
                  d.style.cssText = "width:100%;height:100%;background:#919ca1;display:block;";
                  e.currentTarget.parentElement?.appendChild(d);
                }}
              />
            </div>

          </div>

          {/* BODY */}
          <div style={{ display: "flex", position: "relative" }}>

            {/* SIDEBAR TEXT */}
            <div style={{
              width: "55mm",
              minWidth: "55mm",
              flexShrink: 0,
              paddingTop: "12.6mm",
              paddingLeft: "5.8mm",
              paddingRight: "4mm",
              paddingBottom: "10mm",
              color: "rgba(255,255,255,0.90)",
              fontSize: "8.5pt",
              lineHeight: 1.55,
              position: "relative",
              zIndex: 1,
            }}>
              {([
                {
                  heading: "Personalia",
                  items: ["Født 1990", "Norsk, morsmål", "Engelsk, flytende", "Norsk statsborger", "Kan sikkerhetsklareres"],
                },
                {
                  heading: "Nøkkelpunkter",
                  items: ["C,C++, Python, QT", "Embedded Linux, Yocto, U-Boot, core split", "Mikrokontrollere", "Sanntidssystemer", "BLE, LoRa, RFID, NFC", "CI/CD, funksjonell testing", "Layout og skjematikk", "Altium, KiCAD, Eagle", "Project management", "Design control, Quality in production", "Patent experience", "Soft funding applications", "Medical Device regulations, ISO/IEC 9001"],
                },
                {
                  heading: "Utdannelse",
                  items: ["MSc. Innvevde Systemer, NTNU"],
                },
              ] as { heading: string; items: string[] }[]).map((section) => (
                <div key={section.heading} style={{ marginBottom: "5mm" }}>
                  <div style={{ fontWeight: 800, fontSize: "8.5pt", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "2mm", color: "#ffffff" }}>
                    {section.heading}
                  </div>
                  {section.items.map((item) => (
                    <div key={item} style={{ display: "flex", gap: "3.2mm", marginBottom: "0.8mm", alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* MAIN CONTENT */}
            <div style={{
              flex: 1,
              paddingTop: "12.6mm",
              paddingLeft: "12.8mm",
              paddingRight: "8.2mm",
              paddingBottom: "10mm",
              background: "#ffffff",
              fontSize: "12pt",
              lineHeight: 1.46,
              color: "#1a1a1a",
            }}>

              {[
                "Mattis har solid og bred erfaring med utvikling av sikkerhetskritiske embedded-løsninger, inkludert design av kretskort, systemarkitektur, firmware og GUI-applikasjoner. Han har jobbet både som tech lead, senior utvikler, og CTO og kombinert teknisk ledelse med dyp utviklingskompetanse i komplekse og regulatoriske prosjekter.",
                "Hans kjernekompetanse inkluderer kretskortdesign, C/C++, Qt, Python, elektronikk og kommunikasjonsprotokoller som BLE, LoRa, RFID og NFC. Han har også solid erfaring med kvalitetssikring i produksjon – fra testoppsett til ferdig sammenstilling – og med regulatorisk dokumentasjon for CE-godkjenning i Europa og FDA i USA.",
                "Mattis har arbeidet med sensorteknologier som akselerometer, gyro, ultralyd, kjemiske målere og optikk, og samarbeidet med en rekke selskaper i både Norge og internasjonalt. Han har presentert for og oppnådd støtte fra European Innovation Council (Seal of Excellence) og vunnet Venture Cup for innovativ Bluetooth-teknologi.",
                "Han er kjent for å være en løsningsorientert, kunnskapsrik og samarbeidsvillig kollega med høy teknologisk integritet og sterk gjennomføringsevne. Mattis er lett å jobbe med i team, og bidrar aktivt til godt samarbeid og teknisk kvalitet.",
              ].map((text, i) => (
                <p key={i} style={{ margin: "0 0 4mm 0" }}>{text}</p>
              ))}

              {[
                ["Programmeringsspråk og verktøy", "C, C++, Python, Qt, Matlab, Bash, Go, VHDL, Assembly, (Perl, JavaScript, HTML, PHP)"],
                ["Embedded-teknologier", "Embedded Linux, Yocto, U-Boot, RTOS, bootloader, core split, mikrokontrollere"],
                ["Hardware og utviklingsverktøy", "PCB-design (Altium, KiCAD, Eagle), FPGA, layout og skjematikk, debugging, oscilloskop, logikkanalysator, spektrumanalysator"],
                ["Kommunikasjon og protokoller", "BLE, LoRa, RFID, NFC, I²C/TWI, SPI, RS232, RS485, HDMI, TCP, UDP, SSH, SCP, UART, USART"],
                ["DevOps og testing", "CI/CD, Jenkins, Docker, GTest, PyTest, testdrevet utvikling, crosskompilering, board bringup, funksjonell testing"],
                ["Regulatorisk og ledelse", "ISO/IEC 60601, 13485, 62304, 14971, CE/FDA-godkjenning, medisinteknisk utvikling, prosjektledelse, risikohåndtering"],
              ].map(([label, content]) => (
                <p key={label} style={{ margin: "0 0 3mm 0" }}>
                  <strong>{label}:</strong> {content}
                </p>
              ))}

              <div style={{ fontWeight: 800, fontSize: "13pt", textTransform: "uppercase" as const, color: "#000000", marginTop: "8mm", marginBottom: "3mm", paddingBottom: "1.5mm", borderBottom: "1px solid #aaaaaa", letterSpacing: "0.03em", lineHeight: 1.1 }}>Prosjekter</div>

              {([
                {
                  company: "Respinor AS",
                  subtitle: "Utvikling av ultralydsensor for respiratorpasienter",
                  role: "Tech Lead, Senior Software Engineer og CTO",
                  periode: "6/24-6/25",
                  desc: ["RESPINOR AS er et norsk medisinsk selskap som revolusjonerer overvåkning av pasienter på respirator.", "Hos RESPINOR jobbet Mattis som senior utvikler og CTO i en avgjørende regulatorisk og teknisk fase av prosjektet. Der han satte opp prosjektplan for arbeidet, analyserte svakheter og mangler i produktet, f.eks regulatorisk, verifikasjon og teknisk, cost analyse, ytterligere funksjoner i produkt, og plan for produksjon."],
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
                  desc: ["Cardiaccs er et unikt norsk medisinsk selskap som utvikler den første smarte pacemakertråden for implantering på hjerte under hjertekirurgi og gir kontinuerlig overvåkning av pasienten etter operasjon.", "Mattis startet i Cardiaccs som software utvikler med formål om å utvikle drivere og jobbe med Yocto + QT."],
                  tech: "C++, Python, Yocto, Qt, CMake, GTest, sanntidsdatabehandling, signalbehandling.",
                },
              ] as { company: string; subtitle: string; role: string; periode: string; desc: string[]; tech: string }[]).map((p) => (
                <div key={p.company + p.periode} className="cv-project-block" style={{ marginBottom: "6mm" }}>
                  <div style={{ fontWeight: 800, fontSize: "11pt", color: "#000000", marginBottom: "0.5mm", lineHeight: 1.1 }}>{p.company}</div>
                  <div style={{ fontWeight: 700, fontSize: "11pt", color: "#1a1a1a", marginBottom: "1.5mm", lineHeight: 1.2 }}>{p.subtitle}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt", color: "#555555", marginBottom: "3mm" }}>
                    <span><strong style={{ color: "#1a1a1a" }}>Rolle:</strong> {p.role}</span>
                    <span style={{ flexShrink: 0, marginLeft: "4mm" }}><strong style={{ color: "#1a1a1a" }}>Periode</strong>: {p.periode}</span>
                  </div>
                  {p.desc.map((d, i) => (
                    <p key={i} style={{ margin: "0 0 3mm 0", lineHeight: 1.46 }}>{d}</p>
                  ))}
                  <p style={{ margin: 0, lineHeight: 1.46 }}>
                    <strong>Teknologier:</strong> {p.tech}
                  </p>
                </div>
              ))}

              <div style={{ fontWeight: 800, fontSize: "13pt", textTransform: "uppercase" as const, color: "#000000", marginTop: "8mm", marginBottom: "3mm", paddingBottom: "1.5mm", borderBottom: "1px solid #aaaaaa", letterSpacing: "0.03em", lineHeight: 1.1 }}>Utdannelse</div>
              <div style={{ display: "flex", gap: "8mm", marginBottom: "3mm" }}>
                <span style={{ minWidth: "22mm", flexShrink: 0 }}>2011 – 2017</span>
                <span>Master i elektronikk fra NTNU, med spesialisering i innvevde systemer</span>
              </div>

              <div style={{ fontWeight: 800, fontSize: "13pt", textTransform: "uppercase" as const, color: "#000000", marginTop: "8mm", marginBottom: "3mm", paddingBottom: "1.5mm", borderBottom: "1px solid #aaaaaa", letterSpacing: "0.03em", lineHeight: 1.1 }}>Arbeidserfaring</div>
              {([
                ["2025 –", "STACQ AS"],
                ["2024 – 2025", "RESPINOR AS"],
                ["2022 – 2024", "Cardiaccs AS"],
                ["2017 – 2022", "Glucoset AS"],
              ] as [string, string][]).map(([year, company]) => (
                <div key={year} style={{ display: "flex", gap: "8mm", marginBottom: "2mm" }}>
                  <span style={{ minWidth: "22mm", flexShrink: 0 }}>{year}</span>
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
