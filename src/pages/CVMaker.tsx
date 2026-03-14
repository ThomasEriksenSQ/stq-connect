cd ~/Documents/GitHub/stq-connect && node << 'EOF'
const fs = require('fs');

const content = `import { useEffect, useState } from "react";

export default function CVMaker() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-styles";
    style.textContent = \`
      @media print {
        @page { size: A4; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        body { margin: 0; padding: 0; background: white; }
        body > * { display: none; }
        .cv-print-root { display: block; position: absolute; top: 0; left: 0; width: 100%; }
        .no-print { display: none; }
        .cv-document { width: 210mm; margin: 0; box-shadow: none; padding: 0; overflow: visible; }
        .cv-project-block { page-break-inside: avoid; break-inside: avoid; }
        p { orphans: 3; widows: 3; }
      }
    \`;
    document.head.appendChild(style);
    return () => { document.getElementById("cv-print-styles")?.remove(); };
  }, []);

  const [overflowWarning, setOverflowWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const cvDoc = document.querySelector('.cv-document');
      const prosjekter = Array.from(document.querySelectorAll('.cv-document div')).find((d) =>
        d.textContent.trim() === 'Prosjekter'
      );
      if (cvDoc && prosjekter) {
        const cvTop = cvDoc.getBoundingClientRect().top;
        const pxPerMm = cvDoc.getBoundingClientRect().width / 210;
        const pTop_mm = (prosjekter.getBoundingClientRect().top - cvTop) / pxPerMm;
        setOverflowWarning(pTop_mm < 297);
      }
    }, 500);
    return () => clearTimeout(timer);
  });

  return (
    <div style={{ background: "#d0d0d0", minHeight: "100vh", padding: "24px 0" }}>
      {overflowWarning && (
        <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 10px auto", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#856404" }}>
          ⚠️ <strong>Forsiden er for lang</strong> — Prosjekter starter på side 1. Kutt tekst så Prosjekter alltid starter på side 2.
        </div>
      )}
      <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 20px auto", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={async () => {
            const el = document.querySelector('.cv-document') as HTMLElement;
            if (!el) return;
            const { default: h2c } = await import('html2canvas');
            const { default: jsPDF } = await import('jspdf');
            const canvas = await h2c(el, { scale: 3, useCORS: true, scrollY: 0, windowWidth: 794 });
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const iw = 210;
            const ih = (canvas.height * 210) / canvas.width;
            let y = 0; let rem = ih; let pg = 0;
            while (rem > 0) {
              if (pg > 0) pdf.addPage();
              pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, -y, iw, ih);
              y += 297; rem -= 297; pg++;
            }
            pdf.save('Mattis_Spieler_Asp_CV.pdf');
          }}
          style={{ background: "#1a1a1a", color: "white", border: "none", borderRadius: 6, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Last ned PDF
        </button>
      </div>

      <div className="cv-print-root">
        <div className="cv-document" style={{ width: "210mm", minHeight: "297mm", margin: "0 auto", fontFamily: "Carlito, Calibri, Arial, sans-serif", color: "#1a1a1a", background: "#ffffff", boxShadow: "0 4px 32px rgba(0,0,0,0.20)", display: "grid", gridTemplateColumns: "55mm 1fr", gridTemplateRows: "auto 1fr", position: "relative", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", colorAdjust: "exact" } as React.CSSProperties}>

          <div style={{ position: "absolute", top: 0, left: 0, width: "55mm", bottom: 0, background: "#000000", zIndex: 0 }} />

          <div style={{ gridColumn: "1 / -1", gridRow: 1, position: "relative", height: "71.4mm", zIndex: 1 }}>
            <div style={{ position: "absolute", top: "5mm", left: "4mm", zIndex: 10 }}>
              <img src="/STACQ_logo.png" alt="STACQ" style={{ height: "34px", filter: "brightness(0) invert(1)", display: "block" }} />
            </div>
            <div style={{ position: "absolute", top: "5mm", right: "8mm", zIndex: 10, borderLeft: "2px solid #ccc", paddingLeft: "12px", fontSize: "13px", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#111" }}>Kontaktperson</div>
              <div style={{ color: "#444" }}>Jon Richard Nygaard</div>
              <div style={{ color: "#888", fontSize: "12px" }}>932 87 267 / jr@stacq.no</div>
            </div>
            <div style={{ position: "absolute", top: "31.2mm", left: 0, right: 0, height: "34.3mm", background: "#f2f2f2", zIndex: 2 }}>
              <div style={{ position: "absolute", left: "57mm", top: 0, bottom: 0, right: 0, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "8mm" }}>
                <div style={{ fontSize: "42px", fontWeight: 800, whiteSpace: "nowrap", letterSpacing: "-0.01em", lineHeight: 1.1 }}>Mattis Spieler Asp</div>
                <div style={{ fontSize: "15px", letterSpacing: "0.1em", marginTop: "8px", whiteSpace: "nowrap", color: "#333" }}>Senior Embedded-ingeniør med 8 års erfaring</div>
              </div>
            </div>
            <div style={{ position: "absolute", top: "22mm", left: "5.6mm", width: "43.7mm", height: "49mm", zIndex: 3, overflow: "hidden" }}>
              <img src="/Mattis_CV.png" alt="Mattis" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 15%", display: "block" }} />
            </div>
          </div>

          <div style={{ position: "relative", background: "#000", gridColumn: 1, gridRow: 2, padding: "6mm 5mm 10mm 5mm", color: "rgba(255,255,255,0.90)", fontSize: "8.5pt", lineHeight: 1.55, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", colorAdjust: "exact" } as React.CSSProperties}>
            {([
              { heading: "Personalia", items: ["Født 1990", "Norsk, morsmål", "Engelsk, flytende", "Norsk statsborger", "Kan sikkerhetsklareres"] },
              { heading: "Nøkkelpunkter", items: ["C,C++, Python, QT", "Embedded Linux, Yocto, U-Boot, core split", "Mikrokontrollere", "Sanntidssystemer", "BLE, LoRa, RFID, NFC", "CI/CD, funksjonell testing", "Layout og skjematikk", "Altium, KiCAD, Eagle", "Project management", "Design control, Quality in production", "Patent experience", "Soft funding applications", "Medical Device regulations, ISO/IEC 9001"] },
              { heading: "Utdannelse", items: ["MSc. Innvevde Systemer, NTNU"] },
            ] as { heading: string; items: string[] }[]).map((s) => (
              <div key={s.heading} style={{ marginBottom: "5mm" }}>
                <div style={{ fontWeight: 800, fontSize: "8.5pt", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "2mm", color: "#fff" }}>{s.heading}</div>
                {s.items.map((item) => (
                  <div key={item} style={{ display: "flex", gap: "2mm", marginBottom: "0.8mm" }}>
                    <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.5)" }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ gridColumn: 2, gridRow: 2, padding: "8mm 8mm 10mm 8mm", fontSize: "11pt", lineHeight: 1.55, color: "#1a1a1a", background: "#fff" }}>
            {["Mattis har solid og bred erfaring med utvikling av sikkerhetskritiske embedded-løsninger, inkludert design av kretskort, systemarkitektur, firmware og GUI-applikasjoner. Han har jobbet både som tech lead, senior utvikler, og CTO og kombinert teknisk ledelse med dyp utviklingskompetanse i komplekse og regulatoriske prosjekter.", "Hans kjernekompetanse inkluderer kretskortdesign, C/C++, Qt, Python, elektronikk og kommunikasjonsprotokoller som BLE, LoRa, RFID og NFC. Han har også solid erfaring med kvalitetssikring i produksjon – fra testoppsett til ferdig sammenstilling – og med regulatorisk dokumentasjon for CE-godkjenning i Europa og FDA i USA.", "Mattis har arbeidet med sensorteknologier som akselerometer, gyro, ultralyd, kjemiske målere og optikk, og samarbeidet med en rekke selskaper i både Norge og internasjonalt. Han har presentert for og oppnådd støtte fra European Innovation Council (Seal of Excellence) og vunnet Venture Cup for innovativ Bluetooth-teknologi.", "Han er kjent for å være en løsningsorientert, kunnskapsrik og samarbeidsvillig kollega med høy teknologisk integritet og sterk gjennomføringsevne. Mattis er lett å jobbe med i team, og bidrar aktivt til godt samarbeid og teknisk kvalitet."].map((text, i) => <p key={i} style={{ margin: "0 0 4mm 0" }}>{text}</p>)}

            {[["Programmeringsspråk og verktøy", "C, C++, Python, Qt, Matlab, Bash, Go, VHDL, Assembly, (Perl, JavaScript, HTML, PHP)"], ["Embedded-teknologier", "Embedded Linux, Yocto, U-Boot, RTOS, bootloader, core split, mikrokontrollere"], ["Hardware og utviklingsverktøy", "PCB-design (Altium, KiCAD, Eagle), FPGA, layout og skjematikk, debugging, oscilloskop, logikkanalysator, spektrumanalysator"], ["Kommunikasjon og protokoller", "BLE, LoRa, RFID, NFC, I²C/TWI, SPI, RS232, RS485, HDMI, TCP, UDP, SSH, SCP, UART, USART"], ["DevOps og testing", "CI/CD, Jenkins, Docker, GTest, PyTest, testdrevet utvikling, crosskompilering, board bringup, funksjonell testing"], ["Regulatorisk og ledelse", "ISO/IEC 60601, 13485, 62304, 14971, CE/FDA-godkjenning, medisinteknisk utvikling, prosjektledelse, risikohåndtering"]].map(([label, content]) => <p key={label} style={{ margin: "0 0 3mm 0" }}><strong>{label}:</strong> {content}</p>)}

            <div style={{ fontWeight: 800, fontSize: "13pt", textTransform: "uppercase" as const, color: "#000", marginTop: "7mm", marginBottom: "3mm", paddingBottom: "1.5mm", borderBottom: "1px solid #aaa", letterSpacing: "0.03em" }}>Prosjekter</div>
            {[
              { company: "Respinor AS", subtitle: "Utvikling av ultralydsensor for respiratorpasienter", role: "Tech Lead, Senior Software Engineer og CTO", periode: "6/24-6/25", desc: ["RESPINOR AS er et norsk medisinsk selskap som revolusjonerer overvåkning av pasienter på respirator.", "Hos RESPINOR jobbet Mattis som senior utvikler og CTO i en avgjørende regulatorisk og teknisk fase av prosjektet."], tech: "Ultralyd, accelerometer, gyroskop, RS485, I2C, Yocto, embedded C, C++, Altium, BOM management." },
              { company: "Cardiaccs AS", subtitle: "NFC og energy harvesting application", role: "Tech Lead, Senior Software Engineer og CTO", periode: "1/23-4/23", desc: ["Cardiaccs ønsket å utvide produktgruppen og utvikle alternativer til direkte tilkobling til strømkilde som ble erstattet med energihøsting og NFC."], tech: "Fleksibel PCB, C++, Arduino, NFC, energy harvesting, driverutvikling, prototyping, patentering." },
              { company: "Cardiaccs AS", subtitle: "Utvikling av smart pacemakertråd", role: "Tech Lead, Senior Software Engineer og CTO", periode: "1/22-5/24", desc: ["Cardiaccs er et unikt norsk medisinsk selskap som utvikler den første smarte pacemakertråden for implantering på hjerte under hjertekirurgi.", "Mattis startet i Cardiaccs som software utvikler med formål om å utvikle drivere og jobbe med Yocto + QT."], tech: "C++, Python, Yocto, Qt, CMake, GTest, sanntidsdatabehandling, signalbehandling." },
            ].map((p) => (
              <div key={p.company + p.periode} className="cv-project-block" style={{ marginBottom: "5mm" }}>
                <div style={{ fontWeight: 800, fontSize: "11pt", color: "#000", marginBottom: "0.5mm" }}>{p.company}</div>
                <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "1.5mm" }}>{p.subtitle}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", color: "#555", marginBottom: "2mm" }}>
                  <span><strong style={{ color: "#1a1a1a" }}>Rolle:</strong> {p.role}</span>
                  <span style={{ flexShrink: 0, marginLeft: "4mm" }}><strong style={{ color: "#1a1a1a" }}>Periode:</strong> {p.periode}</span>
                </div>
                {p.desc.map((d, i) => <p key={i} style={{ margin: "0 0 2mm 0" }}>{d}</p>)}
                <p style={{ margin: 0, fontSize: "9.5pt" }}><strong>Teknologier:</strong> {p.tech}</p>
              </div>
            ))}

            <div style={{ fontWeight: 800, fontSize: "13pt", textTransform: "uppercase" as const, color: "#000", marginTop: "7mm", marginBottom: "3mm", paddingBottom: "1.5mm", borderBottom: "1px solid #aaa", letterSpacing: "0.03em" }}>Utdannelse</div>
            <div style={{ display: "flex", gap: "8mm", marginBottom: "3mm" }}>
              <span style={{ minWidth: "22mm", flexShrink: 0 }}>2011 – 2017</span>
              <span>Master i elektronikk fra NTNU, med spesialisering i innvevde systemer</span>
            </div>

            <div style={{ fontWeight: 800, fontSize: "13pt", textTransform: "uppercase" as const, color: "#000", marginTop: "7mm", marginBottom: "3mm", paddingBottom: "1.5mm", borderBottom: "1px solid #aaa", letterSpacing: "0.03em" }}>Arbeidserfaring</div>
            {[["2025 –", "STACQ AS"], ["2024 – 2025", "RESPINOR AS"], ["2022 – 2024", "Cardiaccs AS"], ["2017 – 2022", "Glucoset AS"]].map(([year, company]) => (
              <div key={year} style={{ display: "flex", gap: "8mm", marginBottom: "2mm" }}>
                <span style={{ minWidth: "22mm", flexShrink: 0 }}>{year}</span>
                <span>{company}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}`;

fs.writeFileSync('src/pages/CVMaker.tsx', content);
console.log('done, lines:', content.split('\n').length);
EOF