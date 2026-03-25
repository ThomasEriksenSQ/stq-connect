import { useEffect, useRef, useState } from "react";

type SidebarSection = {
  heading: string;
  items: string[];
};

type CompetenceGroup = {
  label: string;
  content: string;
};

type ProjectEntry = {
  company: string;
  subtitle: string;
  role: string;
  period: string;
  paragraphs: string[];
  technologies: string;
};

type TimelineEntry = {
  period: string;
  primary: string;
  secondary?: string;
};

type HeroContact = {
  title: string;
  name: string;
  phone: string;
  email: string;
};

type HeroContent = {
  name: string;
  title: string;
  contact: HeroContact;
};

type CVDocument = {
  hero: HeroContent;
  sidebarSections: SidebarSection[];
  introParagraphs: string[];
  competenceGroups: CompetenceGroup[];
  projects: ProjectEntry[];
  education: TimelineEntry[];
  workExperience: TimelineEntry[];
};

const mm = (value: number) => `${value}mm`;
const pt = (value: number) => `${value}pt`;
const px = (value: number) => `${value}px`;
const paddingMm = (top: number, right: number, bottom: number, left: number) =>
  `${mm(top)} ${mm(right)} ${mm(bottom)} ${mm(left)}`;

const CV_LAYOUT = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  sidebarWidthMm: 55,
  measureContentWidthMm: 155,
  firstPageHeroHeightMm: 71.4,
  continuationTopPaddingMm: 25.5,
  sidebarPadding: {
    topMm: 8.8,
    rightMm: 4.8,
    bottomMm: 10.5,
    leftMm: 6.8,
  },
  mainPadding: {
    topMm: 8.8,
    rightMm: 8.9,
    bottomMm: 10.2,
    leftMm: 8.9,
  },
  hero: {
    topRowHeightMm: 31.25,
    grayBandHeightMm: 34.2,
    logoBoxHeightMm: 24.8,
    portraitLeftMm: 6.8,
    portraitWidthMm: 41.4,
    portraitHeightMm: 46.75,
    firstPagePortraitTopMm: 24.8,
    continuationPortraitTopMm: 26.5,
    textTopMm: 39.9,
    textLeftMm: 63.9,
    textWidthMm: 124,
    contactRightMm: 7.8,
    contactHeightMm: 31.25,
    contactWidthMm: 41.5,
    contactSeparatorHeightMm: 16.9,
    contactSeparatorOffsetMm: 1.2,
  },
  screen: {
    pageGapPx: 16,
    topPaddingPx: 24,
    bottomPaddingPx: 40,
    controlsGapPx: 12,
  },
} as const;

const CV_PRINT = {
  documentTitle: "Mattis_Spieler_Asp_CV",
  previewBackground: "#d7d7d7",
  helperText: 'For beste PDF-kvalitet, velg "Lagre som PDF" i print-dialogen.',
} as const;

const cvDocument: CVDocument = {
  hero: {
    name: "Mattis Spieler Asp",
    title: "Senior Embedded-ingeniør med 8 års erfaring",
    contact: {
      title: "Kontaktperson",
      name: "Jon Richard Nygaard",
      phone: "932 87 267",
      email: "jr@stacq.no",
    },
  },
  sidebarSections: [
    {
      heading: "Personalia",
      items: ["Født 1990", "Norsk, morsmål", "Engelsk, flytende", "Norsk statsborger", "Kan sikkerhetsklareres"],
    },
    {
      heading: "Nøkkelpunkter",
      items: [
        "C, C++, Python, Qt",
        "Embedded Linux, Yocto, U-Boot, core split",
        "Mikrokontrollere",
        "Sanntidssystemer",
        "BLE, LoRa, RFID, NFC",
        "CI/CD, funksjonell testing",
        "Layout og skjematikk",
        "Altium, KiCAD, Eagle",
        "Prosjektledelse",
        "Design control og Quality in production",
        "Patent experience",
        "Soft funding applications",
        "Medical Device regulations, ISO/IEC 9001",
      ],
    },
    {
      heading: "Utdannelse",
      items: ["MSc. Innvevde Systemer, NTNU"],
    },
  ],
  introParagraphs: [
    "Mattis har solid og bred erfaring med utvikling av sikkerhetskritiske embedded-løsninger, inkludert design av kretskort, systemarkitektur, firmware og GUI-applikasjoner. Han har jobbet både som tech lead, senior utvikler og CTO, og kombinert teknisk ledelse med dyp utviklingskompetanse i komplekse og regulatoriske prosjekter.",
    "Hans kjernekompetanse inkluderer kretskortdesign, C/C++, Qt, Python, elektronikk og kommunikasjonsprotokoller som BLE, LoRa, RFID og NFC. Han har også solid erfaring med kvalitetssikring i produksjon, fra testoppsett til ferdig sammenstilling, og med regulatorisk dokumentasjon for CE-godkjenning i Europa og FDA i USA.",
    "Mattis har arbeidet med sensorteknologier som akselerometer, gyro, ultralyd, kjemiske målere og optikk, og samarbeidet med en rekke selskaper i både Norge og internasjonalt. Han har presentert for og oppnådd støtte fra European Innovation Council og vunnet Venture Cup for innovativ Bluetooth-teknologi.",
    "Han er kjent for å være en løsningsorientert, kunnskapsrik og samarbeidsvillig kollega med høy teknologisk integritet og sterk gjennomføringsevne. Mattis er lett å jobbe med i team, og bidrar aktivt til godt samarbeid og teknisk kvalitet.",
  ],
  competenceGroups: [
    {
      label: "Programmeringsspråk og verktøy",
      content: "C, C++, Python, Qt, Matlab, Bash, Go, VHDL, Assembly, Perl, JavaScript, HTML og PHP.",
    },
    {
      label: "Embedded-teknologier",
      content: "Embedded Linux, Yocto, U-Boot, RTOS, bootloader, core split og mikrokontrollere.",
    },
    {
      label: "Hardware og utviklingsverktøy",
      content:
        "PCB-design i Altium, KiCAD og Eagle, FPGA, layout og skjematikk, debugging, oscilloskop, logikkanalysator og spektrumanalysator.",
    },
    {
      label: "Kommunikasjon og protokoller",
      content: "BLE, LoRa, RFID, NFC, I²C/TWI, SPI, RS232, RS485, HDMI, TCP, UDP, SSH, SCP, UART og USART.",
    },
    {
      label: "DevOps og testing",
      content:
        "CI/CD, Jenkins, Docker, GTest, PyTest, testdrevet utvikling, crosskompilering, board bringup og funksjonell testing.",
    },
    {
      label: "Regulatorisk og ledelse",
      content:
        "ISO/IEC 60601, 13485, 62304, 14971, CE/FDA-godkjenning, medisinteknisk utvikling, prosjektledelse og risikohåndtering.",
    },
  ],
  projects: [
    {
      company: "RESPINOR AS",
      subtitle: "Utvikling av ultralydsensor for respiratorpasienter",
      role: "Tech Lead, Senior Software Engineer og CTO",
      period: "jun. 2024 - jun. 2025",
      paragraphs: [
        "RESPINOR AS er et norsk medisinsk selskap som revolusjonerer overvåkning av pasienter på respirator. Hos RESPINOR jobbet Mattis som senior utvikler og CTO i en avgjørende regulatorisk og teknisk fase av prosjektet.",
        "Han satte opp prosjektplan for arbeidet, analyserte svakheter og mangler i produktet regulatorisk, teknisk og kommersielt, og la plan for produksjon, videre funksjoner og kostnadsforbedringer.",
        "Mattis designet og bidro til utvikling og debugging av flere verifikasjonssystemer for blant annet elektromagnetisk avstandsmåling, kalibrering, test av akselerometer, sanntidstesting, loggføring av feil og akseptansetesting av nye elektriske komponenter.",
        "Gjennom ett år i RESPINOR skrev han kravspesifikasjon, organiserte Bill of Materials og kvalitetssystem, reduserte produksjonskostnadene betydelig, sikret CE-godkjenning og bidro til å få produktet klart for full produksjon og salg.",
      ],
      technologies:
        "Ultralyd, accelerometer, gyroskop, RS485, I2C, Yocto, embedded C, C++, Altium, BOM management og produksjonsteknikk.",
    },
    {
      company: "Cardiaccs AS",
      subtitle: "NFC og energy harvesting application",
      role: "Tech Lead, Senior Software Engineer og CTO",
      period: "jan. 2023 - apr. 2023",
      paragraphs: [
        "Cardiaccs ønsket å utvide produktgruppen og utvikle alternativer til direkte tilkobling til strømkilde, erstattet med energihøsting og NFC.",
        "Mattis utviklet PCB på fleksibel krets, bygget drivere i C++ og jobbet med applikasjonskode og prototyping for å gjøre løsningen teknisk og produksjonsmessig gjennomførbar.",
      ],
      technologies: "Fleksibel PCB, C++, Arduino, NFC, energy harvesting, driverutvikling, prototyping og patentering.",
    },
    {
      company: "Cardiaccs AS",
      subtitle: "Utvikling av smart pacemakertråd",
      role: "Tech Lead, Senior Software Engineer og CTO",
      period: "jan. 2022 - mai 2024",
      paragraphs: [
        "Cardiaccs utvikler den første smarte pacemakertråden for implantering på hjertet og kontinuerlig overvåkning av pasienten etter operasjon. Mattis startet som softwareutvikler med ansvar for drivere, Yocto og Qt.",
        "Han omstrukturerte CMake-oppsett for å skille bibliotek, applikasjonskode, Qt og backend, og integrerte GTest i pakkestrukturen. Videre tok han initiativ til og utviklet et nytt analyseverktøy i Python og C++ for sammenligning av kliniske data.",
        "Analyseverktøyet ble kritisk for å hente ut data fra ulike algoritmer i samme tidsystem og for å identifisere hvilke funksjoner som skulle velges til sluttproduktet.",
      ],
      technologies: "C++, Python, Yocto, Qt, CMake, GTest, sanntidsdatabehandling og signalbehandling.",
    },
    {
      company: "Cardiaccs AS",
      subtitle: "Flex print PCB for 80% reduksjon av produksjonskostnad",
      role: "HW Engineer / Verification Engineer",
      period: "jan. 2022 - mai 2024",
      paragraphs: [
        "Mattis tegnet og utviklet fleksibel PCB for produksjon og bygget testverktøy for å evaluere produktet. Løsningen måtte ivareta biokompatibilitet, vanntett design, høy ESD-toleranse og stabil differensiell kommunikasjon i et svært lite footprint.",
        "Han utviklet også fatigue-testbenk for pacemaker og produksjonsnære testverktøy som kunne oppdage kommunikasjonsfeil, hastighetsavvik og svake koblinger tidlig i kvalitetssikringen.",
      ],
      technologies:
        "Flex print PCB, I2C, accelerometer/gyro, Arduino, servo, display, testbenker, verifikasjon og produksjonskvalitet.",
    },
    {
      company: "Cardiaccs AS",
      subtitle: "Promotering av selskap, strategi og kapitalinnhenting",
      role: "CTO",
      period: "aug. 2023 - des. 2023",
      paragraphs: [
        "I tillegg til tekniske leveranser tok Mattis ansvar for strategi, styrearbeid, regulatoriske løp og kapitalinnhenting i et lite selskap med få ansatte og mange parallelle behov.",
        "Han skrev patenter, støtteordningssøknader og bidro til at selskapet sikret flere millioner kroner i finansiering og internasjonal anerkjennelse gjennom Seal of Excellence.",
      ],
      technologies:
        "C, C++, Python, Qt, Yocto Linux, GTest, GMock, Arduino, ARM-basert hardware, debugging, flex print PCB og signalbehandling.",
    },
    {
      company: "Glucoset AS",
      subtitle: "Glucosemåler for pasienter på intensivavdeling",
      role: "Elektronikkingeniør",
      period: "aug. 2017 - jan. 2018",
      paragraphs: [
        "Mattis designet testverktøy og første prototype for testing på pasient for Glucoset, godkjent av Legemiddelverket i henhold til IEC 60601-1 for sikkerhetskritisk elektronikk på sykehus.",
        "Han utviklet hardware testverktøy som ga utviklere raskere feilsøking og bedre kontroll på om ny kode og ny elektronikk var funksjonell før videre verifikasjon.",
      ],
      technologies:
        "Altium Designer, optiske sensorer, spektrumanalysator, prototypeutvikling, hardware testing, EMC-testing, strømfordeling og IEC 60601-1.",
    },
    {
      company: "Glucoset AS",
      subtitle: "Software testing, grafisk fremstilling og sikker datafremvisning",
      role: "Software Ingeniør",
      period: "jan. 2018 - jan. 2022",
      paragraphs: [
        "Mattis hadde ansvar for software- og hardwareintegrasjon, testing og arkitektur. Han identifiserte svakheter i systemet, forbedret feilhåndtering og bidro til at kritiske algoritmer ble skilt fra GUI for bedre sikkerhet og verifiserbarhet.",
        "Han satte opp U-Boot og Yocto-krysskompilering, fjerninstallasjon via Jenkins og introduserte testdrevet utvikling med GTest. Programvaren ble skrevet i C++ og Qt i tråd med IEC 62304 for medisinsk sikkerhetskritisk software.",
        "Han jobbet også med CPU core split, bare-metal-programmering, VPN/intranett, lineære posisjonssystemer for optisk sammenstilling og dokumentasjon for regulatorisk verifikasjon.",
      ],
      technologies:
        "Altium, C/C++, Yocto, Qt, Python, I2C, SPI, RS232, Labview, Matlab, bare-metal, Assembly, ARM-baserte prosessorer, ESD og EMC testing.",
    },
  ],
  education: [
    {
      period: "2011 – 2017",
      primary: "Master i elektronikk",
      secondary: "NTNU, med spesialisering i innvevde systemer",
    },
  ],
  workExperience: [
    { period: "2025 –", primary: "STACQ AS" },
    { period: "2024 – 2025", primary: "RESPINOR AS" },
    { period: "2022 – 2024", primary: "Cardiaccs AS" },
    { period: "2017 – 2022", primary: "Glucoset AS" },
  ],
};

const { hero, sidebarSections, introParagraphs, competenceGroups, projects, education, workExperience } = cvDocument;

type ContinuationSectionId = "education" | "work";

type ContinuationPageModel = {
  key: string;
  projects: ProjectEntry[];
  sections: ContinuationSectionId[];
};

const CONTINUATION_BOTTOM_PADDING_MM = 10.2;
const CONTINUATION_TARGET_BOTTOM_MARGIN_MM = 14.5;
const CONTINUATION_BOTTOM_BUFFER_MM = CONTINUATION_TARGET_BOTTOM_MARGIN_MM - CONTINUATION_BOTTOM_PADDING_MM;

const PRINT_DOCUMENT_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: white; }
  body { font-family: "Calibri", "Carlito", Arial, sans-serif; }
  .cv-pages { display: block !important; }
  .cv-page {
    width: ${mm(CV_LAYOUT.pageWidthMm)} !important;
    height: ${mm(CV_LAYOUT.pageHeightMm)} !important;
    min-height: ${mm(CV_LAYOUT.pageHeightMm)} !important;
    margin: 0 auto !important;
    box-shadow: none !important;
    overflow: hidden !important;
    page-break-after: always;
    break-after: page;
  }
  .cv-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .cv-project-block {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .no-print { display: none !important; }
  @media screen {
    body {
      background: ${CV_PRINT.previewBackground};
      padding: ${px(CV_LAYOUT.screen.topPaddingPx)} 0 ${px(CV_LAYOUT.screen.bottomPaddingPx)};
    }
    .cv-pages {
      display: flex !important;
      flex-direction: column;
      gap: ${px(CV_LAYOUT.screen.pageGapPx)};
    }
  }
`;

function waitForFontsReady(targetDocument: Document) {
  return "fonts" in targetDocument && "ready" in targetDocument.fonts
    ? targetDocument.fonts.ready.catch(() => undefined)
    : Promise.resolve();
}

function waitForDoubleFrame(win: Window) {
  return new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => resolve());
    });
  });
}

function measureOuterHeight(element: HTMLElement | null) {
  if (!element) return 0;
  const computed = window.getComputedStyle(element);
  return element.getBoundingClientRect().height + parseFloat(computed.marginTop) + parseFloat(computed.marginBottom);
}

function getProjectKey(project: ProjectEntry) {
  return `${project.company}-${project.subtitle}`;
}

function buildContinuationPages({
  projectHeights,
  projectsTitleHeight,
  educationTopHeight,
  educationAfterHeight,
  workTopHeight,
  workAfterHeight,
  availableHeight,
  bottomBuffer,
}: {
  projectHeights: number[];
  projectsTitleHeight: number;
  educationTopHeight: number;
  educationAfterHeight: number;
  workTopHeight: number;
  workAfterHeight: number;
  availableHeight: number;
  bottomBuffer: number;
}): ContinuationPageModel[] {
  const capacity = Math.max(availableHeight - bottomBuffer, 0);

  const getProjectsUsedHeight = (indices: number[]) => {
    if (indices.length === 0) return 0;
    return projectsTitleHeight + indices.reduce((sum, index) => sum + projectHeights[index], 0);
  };

  const projectPages: number[][] = [];
  let currentPage: number[] = [];
  let currentUsed = 0;

  for (let index = 0; index < projects.length; index += 1) {
    const nextUsed =
      currentPage.length === 0 ? projectsTitleHeight + projectHeights[index] : currentUsed + projectHeights[index];

    if (currentPage.length > 0 && nextUsed > capacity) {
      projectPages.push(currentPage);
      currentPage = [index];
      currentUsed = projectsTitleHeight + projectHeights[index];
    } else {
      currentPage.push(index);
      currentUsed = nextUsed;
    }
  }

  if (currentPage.length > 0) {
    projectPages.push(currentPage);
  }

  if (projectPages.length === 0) {
    projectPages.push([]);
  }

  for (let pageIndex = projectPages.length - 1; pageIndex > 0; pageIndex -= 1) {
    let canRebalance = true;

    while (canRebalance) {
      canRebalance = false;
      const previousPage = projectPages[pageIndex - 1];
      const currentPageProjects = projectPages[pageIndex];

      if (previousPage.length <= 1) break;

      const candidateIndex = previousPage[previousPage.length - 1];
      const previousBefore = getProjectsUsedHeight(previousPage);
      const currentBefore = getProjectsUsedHeight(currentPageProjects);
      const previousAfterProjects = previousPage.slice(0, -1);
      const currentAfterProjects = [candidateIndex, ...currentPageProjects];
      const previousAfter = getProjectsUsedHeight(previousAfterProjects);
      const currentAfter = getProjectsUsedHeight(currentAfterProjects);

      if (currentAfter > capacity) break;

      const beforeSpread = Math.abs(capacity - previousBefore - (capacity - currentBefore));
      const afterSpread = Math.abs(capacity - previousAfter - (capacity - currentAfter));
      const beforeWorstGap = Math.max(capacity - previousBefore, capacity - currentBefore);
      const afterWorstGap = Math.max(capacity - previousAfter, capacity - currentAfter);

      if (afterSpread < beforeSpread && afterWorstGap <= beforeWorstGap + 12) {
        previousPage.pop();
        currentPageProjects.unshift(candidateIndex);
        canRebalance = true;
      }
    }
  }

  const models = projectPages.map((pageProjects, index) => ({
    key: `continuation-${index + 1}`,
    projectIndices: [...pageProjects],
    sections: [] as ContinuationSectionId[],
    usedHeight: getProjectsUsedHeight(pageProjects),
  }));

  const appendSection = (sectionId: ContinuationSectionId, topHeight: number, afterHeight: number) => {
    const lastPage = models[models.length - 1];
    const isAtTop = lastPage.usedHeight === 0;
    const sectionHeight = isAtTop ? topHeight : afterHeight;

    if (!isAtTop && lastPage.usedHeight + sectionHeight > capacity) {
      models.push({
        key: `continuation-${models.length + 1}`,
        projectIndices: [],
        sections: [sectionId],
        usedHeight: topHeight,
      });
      return;
    }

    lastPage.sections.push(sectionId);
    lastPage.usedHeight += sectionHeight;
  };

  appendSection("education", educationTopHeight, educationAfterHeight);
  appendSection("work", workTopHeight, workAfterHeight);

  return models.map((page) => ({
    key: page.key,
    projects: page.projectIndices.map((index) => projects[index]),
    sections: page.sections,
  }));
}

const pageStyle = {
  width: mm(CV_LAYOUT.pageWidthMm),
  height: mm(CV_LAYOUT.pageHeightMm),
  minHeight: mm(CV_LAYOUT.pageHeightMm),
  margin: "0 auto",
  background: "#fff",
  color: "#222",
  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
  position: "relative",
  overflow: "hidden",
} satisfies React.CSSProperties;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`,
  height: mm(CV_LAYOUT.pageHeightMm),
  minHeight: mm(CV_LAYOUT.pageHeightMm),
  position: "relative",
} satisfies React.CSSProperties;

const firstPageGridStyle = {
  ...gridStyle,
  gridTemplateRows: `${mm(CV_LAYOUT.firstPageHeroHeightMm)} 1fr`,
} satisfies React.CSSProperties;

const leftRailStyle = {
  background: "#000",
  color: "rgba(255,255,255,0.92)",
  padding: paddingMm(
    CV_LAYOUT.sidebarPadding.topMm,
    CV_LAYOUT.sidebarPadding.rightMm,
    CV_LAYOUT.sidebarPadding.bottomMm,
    CV_LAYOUT.sidebarPadding.leftMm,
  ),
  fontSize: pt(9.1),
  lineHeight: 1.46,
} satisfies React.CSSProperties;

const mainStyle = {
  padding: paddingMm(
    CV_LAYOUT.mainPadding.topMm,
    CV_LAYOUT.mainPadding.rightMm,
    CV_LAYOUT.mainPadding.bottomMm,
    CV_LAYOUT.mainPadding.leftMm,
  ),
  fontSize: pt(10.3),
  lineHeight: 1.42,
  color: "#1f1f1f",
  fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
} satisfies React.CSSProperties;

const continuationMainStyle = {
  ...mainStyle,
  padding: paddingMm(
    CV_LAYOUT.continuationTopPaddingMm,
    CV_LAYOUT.mainPadding.rightMm,
    CV_LAYOUT.mainPadding.bottomMm,
    CV_LAYOUT.mainPadding.leftMm,
  ),
} satisfies React.CSSProperties;

const continuationMeasureContentStyle = {
  width: mm(CV_LAYOUT.measureContentWidthMm),
  boxSizing: "border-box",
  padding: paddingMm(0, CV_LAYOUT.mainPadding.rightMm, 0, CV_LAYOUT.mainPadding.leftMm),
  fontSize: pt(10.3),
  lineHeight: 1.42,
  color: "#1f1f1f",
  fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
} satisfies React.CSSProperties;

const hiddenMeasureRootStyle = {
  position: "absolute",
  top: 0,
  left: "-10000px",
  visibility: "hidden",
  pointerEvents: "none",
  zIndex: -1,
} satisfies React.CSSProperties;

function SectionTitle({ children, marginTop = "6mm" }: { children: string; marginTop?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "3mm",
        marginTop,
        marginBottom: "3mm",
      }}
    >
      <div
        style={{
          fontFamily:
            '"Myriad Pro Light", "Arial Narrow", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
          fontSize: "13.1pt",
          fontWeight: 700,
          letterSpacing: "0.012em",
          textTransform: "uppercase",
          color: "#101010",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      <div style={{ flex: 1, height: "1px", background: "#bfc2c5" }} />
    </div>
  );
}

function Sidebar({ transparentBackground = false }: { transparentBackground?: boolean }) {
  return (
    <div style={{ ...leftRailStyle, background: transparentBackground ? "transparent" : leftRailStyle.background }}>
      {sidebarSections.map((section) => (
        <div key={section.heading} style={{ marginBottom: "5.8mm" }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "11.3pt",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "2.2mm",
              color: "#fff",
              fontFamily: '"Myriad Pro Light", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {section.heading}
          </div>
          {section.items.map((item) => (
            <div key={item} style={{ display: "flex", gap: "1.8mm", marginBottom: "1.05mm" }}>
              <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.7)" }}>•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptySidebar() {
  return (
    <div style={{ background: "#000", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: mm(CV_LAYOUT.hero.topRowHeightMm),
          left: 0,
          width: mm(CV_LAYOUT.sidebarWidthMm),
          height: mm(CV_LAYOUT.hero.grayBandHeightMm),
          background: "#f2f2f2",
        }}
      />
      <Portrait topMm={CV_LAYOUT.hero.continuationPortraitTopMm} />
    </div>
  );
}

function LogoMark() {
  return (
    <img
      src="/STACQ_logo_black.png"
      alt="STACQ"
      style={{ width: mm(39.3), display: "block", filter: "brightness(0) invert(1)" }}
    />
  );
}

function Portrait({ topMm }: { topMm: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: mm(topMm),
        left: mm(CV_LAYOUT.hero.portraitLeftMm),
        width: mm(CV_LAYOUT.hero.portraitWidthMm),
        height: mm(CV_LAYOUT.hero.portraitHeightMm),
        overflow: "hidden",
        background: "#000",
        zIndex: 2,
      }}
    >
      <img
        src="/Mattis_CV.png"
        alt={hero.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 11%",
          display: "block",
        }}
      />
    </div>
  );
}

function ContactBlock({ contact }: { contact: HeroContact }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: mm(CV_LAYOUT.hero.contactRightMm),
        height: mm(CV_LAYOUT.hero.contactHeightMm),
        display: "flex",
        alignItems: "center",
        zIndex: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: px(12),
          fontFamily: '"Verdana", Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: "1.15px",
            height: mm(CV_LAYOUT.hero.contactSeparatorHeightMm),
            marginTop: mm(CV_LAYOUT.hero.contactSeparatorOffsetMm),
            background: "#d5d5d5",
            flexShrink: 0,
          }}
        />
        <div
          style={{
            width: mm(CV_LAYOUT.hero.contactWidthMm),
            fontSize: pt(9.3),
            lineHeight: 1.28,
            color: "#848484",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: pt(9.4), color: "#767676", marginBottom: "0.7mm" }}>
            {contact.title}
          </div>
          <div style={{ color: "#7e7e7e" }}>{contact.name}</div>
          <div style={{ whiteSpace: "nowrap" }}>{contact.phone}</div>
          <div style={{ whiteSpace: "nowrap" }}>{contact.email}</div>
        </div>
      </div>
    </div>
  );
}

function ProjectBlock({ company, subtitle, role, period, paragraphs, technologies }: ProjectEntry) {
  return (
    <div className="cv-project-block" style={{ marginBottom: "6.4mm" }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: "9.9pt",
          color: "#111",
          letterSpacing: "0.006em",
          marginBottom: "1.8mm",
        }}
      >
        {company}
      </div>
      <div
        style={{
          fontWeight: 600,
          fontSize: "9.6pt",
          marginBottom: "2.9mm",
          color: "#242424",
          lineHeight: 1.28,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "6mm",
          fontSize: "8.8pt",
          color: "#666",
          marginBottom: "3.1mm",
        }}
      >
        <span style={{ color: "#4f4f4f" }}>{role}</span>
        <span style={{ flexShrink: 0, color: "#4f4f4f" }}>{period}</span>
      </div>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} style={{ margin: "0 0 2.35mm 0", lineHeight: 1.36 }}>
          {paragraph}
        </p>
      ))}
      <p style={{ margin: "1.2mm 0 0 0", lineHeight: 1.42, color: "#1f1f1f" }}>
        <strong>Teknologier:</strong> {technologies}
      </p>
    </div>
  );
}

function TimelineRow({
  period,
  primary,
  secondary,
  marginBottom = "2.5mm",
}: {
  period: string;
  primary: string;
  secondary?: string;
  marginBottom?: string;
}) {
  return (
    <div style={{ display: "flex", gap: "7mm", marginBottom, alignItems: "flex-start" }}>
      <span
        style={{
          minWidth: "29mm",
          flexShrink: 0,
          color: "#3d3d3d",
          fontSize: "9.4pt",
          lineHeight: 1.3,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
        }}
      >
        {period}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: "0.55mm" }}>
        <span style={{ fontSize: "9.8pt", lineHeight: 1.28, color: "#202020", fontWeight: 600 }}>{primary}</span>
        {secondary ? <span style={{ fontSize: "9.2pt", lineHeight: 1.28, color: "#555" }}>{secondary}</span> : null}
      </span>
    </div>
  );
}

function EducationSection({ marginTop = "6mm" }: { marginTop?: string }) {
  return (
    <>
      <SectionTitle marginTop={marginTop}>Utdannelse</SectionTitle>
      {education.map((entry) => (
        <TimelineRow
          key={entry.period}
          period={entry.period}
          primary={entry.primary}
          secondary={entry.secondary}
          marginBottom="3.4mm"
        />
      ))}
    </>
  );
}

function WorkExperienceSection({ marginTop = "6mm" }: { marginTop?: string }) {
  return (
    <>
      <SectionTitle marginTop={marginTop}>Arbeidserfaring</SectionTitle>
      {workExperience.map((entry) => (
        <TimelineRow key={entry.period} period={entry.period} primary={entry.primary} marginBottom="2.6mm" />
      ))}
    </>
  );
}

function ContinuationPage({
  pageProjects,
  sections,
}: {
  pageProjects: ProjectEntry[];
  sections: ContinuationSectionId[];
}) {
  return (
    <div className="cv-page" style={pageStyle}>
      <div style={gridStyle}>
        <EmptySidebar />

        <div style={continuationMainStyle}>
          {pageProjects.length > 0 ? (
            <>
              <SectionTitle marginTop="0">Prosjekter</SectionTitle>
              {pageProjects.map((project) => (
                <ProjectBlock key={getProjectKey(project)} {...project} />
              ))}
            </>
          ) : null}

          {sections.map((section, index) => {
            const marginTop = pageProjects.length > 0 || index > 0 ? "6mm" : "0";

            if (section === "education") {
              return <EducationSection key={section} marginTop={marginTop} />;
            }

            return <WorkExperienceSection key={section} marginTop={marginTop} />;
          })}
        </div>
      </div>
    </div>
  );
}

export default function CVMaker() {
  const [continuationPages, setContinuationPages] = useState<ContinuationPageModel[]>([]);
  const measureCapacityRef = useRef<HTMLDivElement | null>(null);
  const projectsTitleMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const educationAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const workTopMeasureRef = useRef<HTMLDivElement | null>(null);
  const workAfterMeasureRef = useRef<HTMLDivElement | null>(null);
  const projectMeasureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "STACQ - CV-Editor";
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };
    const desc = setMeta("description", "STACQ - CV-Editor");
    const author = setMeta("author", "STACQ");
    const robots = setMeta("robots", "noindex, nofollow");
    return () => {
      document.title = prevTitle;
      desc.setAttribute("content", "");
      author.setAttribute("content", "");
      robots.setAttribute("content", "");
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cv-print-styles";
    style.textContent = `
      /* Print invariants:
         - each .cv-page maps to one A4 page
         - pagination happens before print
         - web preview and PDF share the same page structure */
      @media print {
        @page { size: ${mm(CV_LAYOUT.pageWidthMm)} ${mm(CV_LAYOUT.pageHeightMm)}; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        html, body { margin: 0; padding: 0; background: white; }
        .cv-print-root { display: block; width: 100%; }
        .cv-pages { display: block !important; }
        .cv-page { height: ${mm(CV_LAYOUT.pageHeightMm)} !important; min-height: ${mm(CV_LAYOUT.pageHeightMm)} !important; margin: 0 !important; box-shadow: none !important; overflow: hidden !important; page-break-after: always; break-after: page; }
        .cv-page:last-child { page-break-after: auto; break-after: auto; }
        .no-print { display: none !important; }
        .cv-project-block { page-break-inside: avoid; break-inside: avoid; }
        p { orphans: 3; widows: 3; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById("cv-print-styles")?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const updatePagination = async () => {
      await waitForFontsReady(document);
      await waitForDoubleFrame(window);

      if (cancelled) return;

      const measureCapacity = measureCapacityRef.current;
      const projectsTitle = projectsTitleMeasureRef.current;
      const educationTop = educationTopMeasureRef.current;
      const educationAfter = educationAfterMeasureRef.current;
      const workTop = workTopMeasureRef.current;
      const workAfter = workAfterMeasureRef.current;

      if (!measureCapacity || !projectsTitle || !educationTop || !educationAfter || !workTop || !workAfter) {
        return;
      }

      const pageHeightPx = measureCapacity.getBoundingClientRect().height;
      const mmToPx = pageHeightPx / 297;
      const bottomBuffer = Math.max(CONTINUATION_BOTTOM_BUFFER_MM, 0) * mmToPx;
      const projectHeights = projects.map((project) =>
        measureOuterHeight(projectMeasureRefs.current[getProjectKey(project)]),
      );

      const nextPages = buildContinuationPages({
        projectHeights,
        projectsTitleHeight: measureOuterHeight(projectsTitle),
        educationTopHeight: measureOuterHeight(educationTop),
        educationAfterHeight: measureOuterHeight(educationAfter),
        workTopHeight: measureOuterHeight(workTop),
        workAfterHeight: measureOuterHeight(workAfter),
        availableHeight: measureCapacity.clientHeight,
        bottomBuffer,
      });

      if (cancelled) return;

      setContinuationPages((current) => (JSON.stringify(current) === JSON.stringify(nextPages) ? current : nextPages));
    };

    updatePagination();
    window.addEventListener("resize", updatePagination);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", updatePagination);
    };
  }, []);

  const openPrintDialog = async () => {
    const sourceRoot = document.querySelector(".cv-print-root") as HTMLElement | null;
    if (!sourceRoot) return;

    const clonedRoot = sourceRoot.cloneNode(true) as HTMLElement;
    const clonedImages = Array.from(clonedRoot.querySelectorAll<HTMLImageElement>("img"));

    clonedImages.forEach((image) => {
      const rawSrc = image.getAttribute("src") ?? image.src;
      image.src = new URL(rawSrc, window.location.href).toString();
    });

    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("aria-hidden", "true");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";
    document.body.appendChild(printFrame);

    const printWindow = printFrame.contentWindow;
    const printDocument = printFrame.contentDocument;
    if (!printWindow || !printDocument) {
      printFrame.remove();
      return;
    }

    printDocument.open();
    printDocument.write(`<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${CV_PRINT.documentTitle}</title>
    <style>${PRINT_DOCUMENT_CSS}</style>
  </head>
  <body>${clonedRoot.outerHTML}</body>
</html>`);
    printDocument.close();

    const readyImages = Array.from(printDocument.querySelectorAll<HTMLImageElement>("img"));
    const imagePromises = readyImages.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const done = () => {
            image.removeEventListener("load", done);
            image.removeEventListener("error", done);
            resolve();
          };

          image.addEventListener("load", done);
          image.addEventListener("error", done);
        }),
    );

    await Promise.all([waitForFontsReady(printDocument), ...imagePromises]);
    await waitForDoubleFrame(printWindow);

    const cleanupPrintFrame = () => {
      printWindow.removeEventListener("afterprint", cleanupPrintFrame);
      printFrame.remove();
    };

    printWindow.focus();
    printWindow.addEventListener("afterprint", cleanupPrintFrame, { once: true });
    window.setTimeout(cleanupPrintFrame, 60000);
    printWindow.print();
  };

  return (
    <div
      style={{
        background: CV_PRINT.previewBackground,
        minHeight: "100vh",
        padding: `${px(CV_LAYOUT.screen.topPaddingPx)} 0 ${px(CV_LAYOUT.screen.bottomPaddingPx)}`,
      }}
    >
      <div
        className="no-print"
        style={{
          maxWidth: mm(CV_LAYOUT.pageWidthMm),
          margin: "0 auto 20px auto",
          display: "flex",
          alignItems: "center",
          gap: px(CV_LAYOUT.screen.controlsGapPx),
        }}
      >
        <button
          onClick={openPrintDialog}
          style={{
            background: "#1a1a1a",
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Last ned PDF
        </button>
      </div>

      <div
        className="no-print"
        style={{
          maxWidth: mm(CV_LAYOUT.pageWidthMm),
          margin: "0 auto 16px auto",
          fontSize: 12,
          color: "#5f5f5f",
        }}
      >
        {CV_PRINT.helperText}
      </div>

      <div aria-hidden="true" className="no-print" style={hiddenMeasureRootStyle}>
        <div
          style={{
            width: mm(CV_LAYOUT.pageWidthMm),
            display: "grid",
            gridTemplateColumns: `${mm(CV_LAYOUT.sidebarWidthMm)} 1fr`,
            height: mm(CV_LAYOUT.pageHeightMm),
          }}
        >
          <div />
          <div ref={measureCapacityRef} style={continuationMainStyle} />
        </div>
        <div style={continuationMeasureContentStyle}>
          <div ref={projectsTitleMeasureRef} style={{ display: "flow-root" }}>
            <SectionTitle marginTop="0">Prosjekter</SectionTitle>
          </div>
          {projects.map((project) => (
            <div
              key={`measure-${getProjectKey(project)}`}
              style={{ display: "flow-root" }}
              ref={(element) => {
                projectMeasureRefs.current[getProjectKey(project)] = element;
              }}
            >
              <ProjectBlock {...project} />
            </div>
          ))}
          <div ref={educationTopMeasureRef} style={{ display: "flow-root" }}>
            <EducationSection marginTop="0" />
          </div>
          <div ref={educationAfterMeasureRef} style={{ display: "flow-root" }}>
            <EducationSection marginTop="6mm" />
          </div>
          <div ref={workTopMeasureRef} style={{ display: "flow-root" }}>
            <WorkExperienceSection marginTop="0" />
          </div>
          <div ref={workAfterMeasureRef} style={{ display: "flow-root" }}>
            <WorkExperienceSection marginTop="6mm" />
          </div>
        </div>
      </div>

      <div className="cv-print-root">
        <div
          className="cv-pages"
          style={{
            fontFamily: '"Calibri", "Carlito", Arial, sans-serif',
            display: "flex",
            flexDirection: "column",
            gap: px(CV_LAYOUT.screen.pageGapPx),
          }}
        >
          <div className="cv-page cv-document" style={pageStyle}>
            <div style={firstPageGridStyle}>
              <div
                style={{
                  gridColumn: "1 / -1",
                  gridRow: 1,
                  position: "relative",
                  overflow: "hidden",
                  background: "transparent",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: mm(CV_LAYOUT.sidebarWidthMm),
                    right: 0,
                    height: mm(CV_LAYOUT.hero.topRowHeightMm),
                    background: "#fff",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    top: mm(CV_LAYOUT.hero.topRowHeightMm),
                    left: 0,
                    right: 0,
                    height: mm(CV_LAYOUT.hero.grayBandHeightMm),
                    background: "#f2f2f2",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: mm(CV_LAYOUT.sidebarWidthMm),
                    height: mm(CV_LAYOUT.hero.logoBoxHeightMm),
                  }}
                >
                  <div
                    style={{
                      width: mm(CV_LAYOUT.sidebarWidthMm),
                      height: mm(CV_LAYOUT.hero.logoBoxHeightMm),
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <LogoMark />
                  </div>
                </div>

                <Portrait topMm={CV_LAYOUT.hero.firstPagePortraitTopMm} />
                <ContactBlock contact={hero.contact} />

                <div
                  style={{
                    position: "absolute",
                    top: mm(CV_LAYOUT.hero.textTopMm),
                    left: mm(CV_LAYOUT.hero.textLeftMm),
                    width: mm(CV_LAYOUT.hero.textWidthMm),
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"Carlito", "Calibri", Arial, sans-serif',
                      fontSize: "32.3pt",
                      fontWeight: 700,
                      letterSpacing: "-0.014em",
                      lineHeight: 0.99,
                      color: "#000",
                    }}
                  >
                    {hero.name}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Raleway", "Helvetica Neue", Arial, sans-serif',
                      fontSize: "11.2pt",
                      fontWeight: 500,
                      marginTop: "3.3mm",
                      letterSpacing: "0.05em",
                      color: "#383838",
                    }}
                  >
                    {hero.title}
                  </div>
                </div>
              </div>

              <div
                style={{
                  gridColumn: 1,
                  gridRow: "1 / -1",
                  background: "#000",
                  zIndex: 0,
                }}
              />

              <div style={{ gridColumn: 1, gridRow: 2, position: "relative", zIndex: 1 }}>
                <Sidebar transparentBackground />
              </div>

              <div style={{ ...mainStyle, gridColumn: 2, gridRow: 2 }}>
                {introParagraphs.map((paragraph) => (
                  <p key={paragraph} style={{ margin: "0 0 3mm 0" }}>
                    {paragraph}
                  </p>
                ))}

                {competenceGroups.map((group) => (
                  <p key={group.label} style={{ margin: "0 0 2.5mm 0" }}>
                    <strong>{group.label}:</strong> {group.content}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {continuationPages.map((page) => (
            <ContinuationPage key={page.key} pageProjects={page.projects} sections={page.sections} />
          ))}
        </div>
      </div>
    </div>
  );
}
