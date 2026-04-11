export type TechnologyFrequencyMap = Record<string, number>;

type TechnologyRule = {
  label: string;
  patterns: RegExp[];
};

const TECHNOLOGY_RULES: TechnologyRule[] = [
  { label: "C++", patterns: [/^c\+\+$/i, /(^|[^A-Za-z0-9])c\+\+([^A-Za-z0-9]|$)/i, /\bmodern c\+\+\b/i] },
  { label: "C", patterns: [/^c$/i, /^ansi c$/i, /^embedded c$/i] },
  { label: "Rust", patterns: [/^rust$/i, /\brust\b/i] },
  { label: "Python", patterns: [/^python$/i, /\bpython\b/i] },
  { label: "Qt", patterns: [/^qt$/i, /\bqt\b/i, /^qt\/qml$/i, /\bqml\b/i] },
  { label: "CMake", patterns: [/^cmake$/i, /\bcmake\b/i] },
  { label: "Yocto", patterns: [/^yocto$/i, /\byocto\b/i] },
  { label: "Buildroot", patterns: [/^buildroot$/i, /\bbuildroot\b/i] },
  { label: "Embedded Linux", patterns: [/^embedded linux$/i, /\bembedded linux\b/i] },
  { label: "Linux", patterns: [/^linux$/i, /(^|[^a-z])linux([^a-z]|$)/i] },
  { label: "Device Tree", patterns: [/^device tree$/i, /\bdevice tree\b/i, /\bdts\b/i, /\bdtb\b/i] },
  { label: "Board bring-up", patterns: [/^board bring[- ]?up$/i, /^bring[- ]?up$/i, /\bboard bring[- ]?up\b/i, /\bbring[- ]?up\b/i] },
  { label: "Zephyr", patterns: [/^zephyr$/i, /\bzephyr\b/i] },
  { label: "FreeRTOS", patterns: [/^freertos$/i, /^free rtos$/i, /\bfreertos\b/i, /\bfree rtos\b/i] },
  { label: "NuttX", patterns: [/^nuttx$/i, /\bnuttx\b/i] },
  { label: "RTOS", patterns: [/^rtos$/i, /\brtos\b/i, /^real[- ]time systems?$/i, /\breal[- ]time systems?\b/i] },
  { label: "Bare metal", patterns: [/^bare metal$/i, /\bbare[- ]metal\b/i] },
  { label: "Firmware", patterns: [/^firmware$/i, /\bfirmware\b/i] },
  { label: "Embedded systems", patterns: [/^embedded$/i, /^embedded systems?$/i, /\bembedded systems?\b/i] },
  { label: "Device drivers", patterns: [/^device drivers?$/i, /\bdevice drivers?\b/i, /\bkernel modules?\b/i, /^kernel drivers?$/i, /\bkernel drivers?\b/i] },
  { label: "FPGA", patterns: [/^fpga$/i, /\bfpga\b/i] },
  { label: "ASIC", patterns: [/^asic$/i, /\basic\b/i] },
  { label: "ARM Cortex-M", patterns: [/^arm cortex m$/i, /^cortex m$/i, /\barm cortex-m\b/i, /\bcortex-m\b/i] },
  { label: "Microcontrollers", patterns: [/^microcontrollers?$/i, /\bmicrocontrollers?\b/i, /^mikrokontroll(?:er|ere|eren|erne)$/i, /\bmikrokontroll(?:er|ere|eren|erne)\b/i] },
  { label: "ARM", patterns: [/^arm$/i, /^arm32$/i, /^arm64$/i, /\barm\b/i] },
  { label: "STM32", patterns: [/^stm32$/i, /\bstm32\b/i] },
  { label: "nRF52", patterns: [/^nrf52$/i, /\bnrf52\b/i] },
  { label: "ESP32", patterns: [/^esp32$/i, /\besp32\b/i] },
  { label: "NXP i.MX", patterns: [/^nxp i\.?mx$/i, /^i\.?mx$/i, /\bi\.?mx(?:[0-9]+)?\b/i] },
  { label: "CAN", patterns: [/^can$/i, /^can bus$/i, /\bcan bus\b/i] },
  { label: "CANopen", patterns: [/^canopen$/i, /\bcanopen\b/i] },
  { label: "Modbus", patterns: [/^modbus$/i, /\bmodbus\b/i] },
  { label: "SPI", patterns: [/^spi$/i, /\bspi\b/i] },
  { label: "I2C", patterns: [/^i2c$/i, /\bi2c\b/i] },
  { label: "UART", patterns: [/^uart$/i, /\buart\b/i] },
  { label: "RS232", patterns: [/^rs232$/i, /\brs ?232\b/i] },
  { label: "RS485", patterns: [/^rs485$/i, /\brs ?485\b/i] },
  { label: "TCP/IP", patterns: [/^tcp\/ip$/i, /^tcp ip$/i, /\btcp\/ip\b/i] },
  { label: "Sockets", patterns: [/^sockets?$/i, /^raw sockets?$/i, /\bsockets?\b/i, /\braw sockets?\b/i] },
  { label: "Ethernet", patterns: [/^ethernet$/i, /\bethernet\b/i] },
  { label: "Ethernet/IP", patterns: [/^ethernet\/ip$/i, /^ethernet ip$/i, /\bethernet\/ip\b/i] },
  { label: "BLE", patterns: [/^ble$/i, /^bluetooth low energy$/i, /\bbluetooth low energy\b/i] },
  { label: "Bluetooth", patterns: [/^bluetooth$/i, /\bbluetooth\b/i] },
  { label: "Wi-Fi", patterns: [/^wifi$/i, /^wi-fi$/i, /\bwi[ -]?fi\b/i] },
  { label: "MQTT", patterns: [/^mqtt$/i, /\bmqtt\b/i] },
  { label: "Protobuf", patterns: [/^protobuf$/i, /^proto(buf)?$/i, /\bprotobuf\b/i] },
  { label: "DDS", patterns: [/^dds$/i, /\bdds\b/i] },
  { label: "CI/CD", patterns: [/^ci\/cd$/i, /^ci-cd$/i, /\bci\/cd\b/i, /\bcontinuous integration\/continuous deployment\b/i] },
  { label: "Docker", patterns: [/^docker$/i, /\bdocker\b/i] },
  { label: "Kubernetes", patterns: [/^kubernetes$/i, /^k8s$/i, /\bkubernetes\b/i, /\bk8s\b/i] },
  { label: "Jenkins", patterns: [/^jenkins$/i, /\bjenkins\b/i] },
  { label: "Git", patterns: [/^git$/i, /\bgit\b/i] },
  { label: "ROS", patterns: [/^ros$/i, /^ros2$/i, /\bros ?2?\b/i] },
  { label: "Robotics", patterns: [/^robotics$/i, /\brobotics?\b/i] },
  { label: "Computer vision", patterns: [/^computer vision$/i, /\bcomputer vision\b/i] },
  { label: "Electronics", patterns: [/^electronics$/i, /^electronics design$/i, /^electronic design$/i, /\belectronics\b/i] },
  { label: "PCB design", patterns: [/^pcb design$/i, /\bpcb design\b/i, /\bhigh-speed design\b/i] },
  { label: "Testing", patterns: [/^testing$/i, /^test$/i, /\bverification\b/i, /\btesting\b/i, /\btest automation\b/i] },
  { label: "Safety", patterns: [/^safety$/i, /\bfunctional safety\b/i, /^functional safety$/i] },
  { label: "Cybersecurity", patterns: [/^cybersecurity$/i, /^security$/i, /\bcyber security\b/i, /\bsecurity\b/i] },
  { label: "TrustZone", patterns: [/^trustzone$/i, /\btrustzone\b/i] },
  { label: "Secure boot", patterns: [/^secure boot$/i, /\bsecure boot\b/i] },
  { label: "Secure storage", patterns: [/^secure storage$/i, /\bsecure storage\b/i] },
  { label: "Crypto", patterns: [/^crypto$/i, /^cryptography$/i, /\bcrypto(graphy)?\b/i] },
  { label: "Fuzzing", patterns: [/^fuzzing$/i, /\bfuzzing\b/i, /\bfuzzer\b/i] },
  { label: "Sanitizers", patterns: [/^sanitizers?$/i, /\bsanitizers?\b/i, /\basan\b/i, /\bubsan\b/i, /\btsan\b/i] },
  { label: "AI", patterns: [/^ai$/i, /^artificial intelligence$/i, /\bartificial intelligence\b/i, /\bai\b/i] },
  { label: "Automation", patterns: [/^automation$/i, /\bautomation\b/i] },
  { label: "Edge Computing", patterns: [/^edge computing$/i, /\bedge computing\b/i] },
  { label: "GIS", patterns: [/^gis$/i, /^maps?$/i, /^geospatial$/i, /\bgis\b/i, /\bgeospatial\b/i] },
  { label: "HIL", patterns: [/^hil$/i, /^hardware[- ]in[- ]the[- ]loop$/i, /\bhardware[- ]in[- ]the[- ]loop\b/i] },
  { label: "UAV", patterns: [/^uavs?$/i, /^drones?$/i, /^unmanned aerial vehicles?$/i, /\buavs?\b/i, /\bdrones?\b/i] },
  { label: "Hardware Integration", patterns: [/^hardware integration$/i, /\bhardware integration\b/i, /^embedded and hardware integration$/i] },
  { label: "Odoo", patterns: [/^odoo$/i, /^odoo[- ]suite$/i, /\bodoo\b/i] },
  { label: "U-Boot", patterns: [/^u-boot$/i, /\bu-boot\b/i] },
  { label: "VHDL", patterns: [/^vhdl$/i, /\bvhdl\b/i] },
  { label: "Xilinx", patterns: [/^xilinx$/i, /\bxilinx\b/i] },
  { label: "LoRa", patterns: [/^lora$/i, /\blora\b/i] },
  { label: "Nordic nRF", patterns: [/^nordic nrf$/i, /\bnrf(?:5|9)[0-9xa-z-]*\b/i, /\bnordic semi\b/i] },
  { label: "Signal processing", patterns: [/^signal processing$/i, /\bsignal processing\b/i, /\bdsp\b/i] },
  { label: "Sensor fusion", patterns: [/^sensor fusion$/i, /\bsensor fusion\b/i, /\bimu\b/i] },
  { label: "Power management", patterns: [/^power management$/i, /\bpower management\b/i, /\bfuel gauge\b/i, /\blow power\b/i] },
];

const IGNORED_VALUES = new Set([
  "",
  "-",
  "n/a",
  "na",
  "ci",
  "cd",
  "none",
  "ukjent",
  "annet",
]);

const IGNORED_PATTERNS = [
  /^communication protocols?$/i,
  /^kommunikasjonsprotokoller$/i,
  /^protocols?$/i,
];

const PRESERVED_COMPOUND_SEGMENTS = [
  /^ci\/cd$/i,
  /^ethernet\/ip$/i,
  /^tcp\/ip$/i,
];

const FALLBACK_BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /@/,
  /[:*]/,
  /\.\./,
  /[()]/,
  /\bosv\b/i,
  /\bse mail\b/i,
  /\bwanted\b/i,
  /\bkanskje\b/i,
  /\bkjennskap\b/i,
  /\berfaring\b/i,
  /\bintegrasjon\b/i,
  /\bintegration\b/i,
  /\bdeployment\b/i,
  /\bpackaging\b/i,
  /\bacceptance\b/i,
  /\bfactory\b/i,
  /\bsette opp\b/i,
  /\bon-prem\b/i,
  /\bcloud\b/i,
  /\bsuite\b/i,
  /\bebom\b/i,
];

const FALLBACK_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "av",
  "eller",
  "for",
  "med",
  "mot",
  "of",
  "og",
  "på",
  "sin",
  "til",
  "to",
  "with",
]);

function sanitizeToken(token: string): string {
  return token
    .replace(/^[\s()[\]-]+|[\s()[\]-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTopLevelSegments(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of raw) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if ((char === "," || char === ";" || char === "\n" || char === "|") && depth === 0) {
      const cleaned = sanitizeToken(current);
      if (cleaned) segments.push(cleaned);
      current = "";
      continue;
    }

    current += char;
  }

  const cleaned = sanitizeToken(current);
  if (cleaned) segments.push(cleaned);
  return segments;
}

function splitCompoundSegment(segment: string): string[] {
  const cleaned = sanitizeToken(segment);
  if (!cleaned) return [];
  if (!cleaned.includes("/")) return [cleaned];
  if (PRESERVED_COMPOUND_SEGMENTS.some((pattern) => pattern.test(cleaned))) return [cleaned];

  if (/^[A-Za-z0-9#+.-]+(?:\s*\/\s*[A-Za-z0-9#+.-]+)+$/.test(cleaned)) {
    return cleaned
      .split("/")
      .map((part) => sanitizeToken(part))
      .filter(Boolean);
  }

  return [cleaned];
}

function titleCaseToken(token: string): string {
  if (/^[A-Z0-9+#./-]+$/.test(token)) return token;

  return token
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z0-9+#./-]+$/.test(part)) return part.toUpperCase();
      if (/^\d/.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function isSafeFallbackTechnologyTag(token: string): boolean {
  if (token.length < 2 || token.length > 40) return false;
  if (!/^[\p{L}\p{N}+#./ -]+$/u.test(token)) return false;
  if (FALLBACK_BLOCKED_PATTERNS.some((pattern) => pattern.test(token))) return false;

  const words = token
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0 || words.length > 3) return false;
  if (words.some((word) => FALLBACK_STOPWORDS.has(word))) return false;

  if (token.includes("/") && !/^[A-Za-z0-9+#.-]+\/[A-Za-z0-9+#.-]+$/.test(token)) return false;

  return true;
}

export function normalizeTechnologyTag(token: string | null | undefined): string | null {
  const cleaned = sanitizeToken(String(token || ""));
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  if (IGNORED_VALUES.has(lower)) return null;
  if (IGNORED_PATTERNS.some((pattern) => pattern.test(cleaned))) return null;

  for (const rule of TECHNOLOGY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(cleaned))) {
      return rule.label;
    }
  }

  if (lower.length < 2 || !isSafeFallbackTechnologyTag(cleaned)) return null;
  return titleCaseToken(cleaned);
}

export function normalizeTechnologyTags(
  values: Array<string | null | undefined> | string | null | undefined,
): string[] {
  const inputs = Array.isArray(values) ? values : values ? [values] : [];
  const result = new Set<string>();

  const pushValue = (value: string) => {
    const normalized = normalizeTechnologyTag(value);
    if (normalized) result.add(normalized);
  };

  inputs.forEach((value) => {
    if (!value) return;

    const topLevelSegments = splitTopLevelSegments(value);
    const baseSegments = topLevelSegments.length > 0 ? topLevelSegments : [value];

    baseSegments.forEach((segment) => {
      splitCompoundSegment(segment).forEach(pushValue);

      const nestedMatches = [...segment.matchAll(/\(([^)]+)\)/g)];
      nestedMatches.forEach((match) => {
        splitTopLevelSegments(match[1]).forEach((nestedSegment) => {
          splitCompoundSegment(nestedSegment).forEach(pushValue);
        });
      });

      const withoutParens = sanitizeToken(segment.replace(/\([^)]*\)/g, " "));
      if (withoutParens && withoutParens !== segment) {
        splitCompoundSegment(withoutParens).forEach(pushValue);
      }
    });

    TECHNOLOGY_RULES.forEach((rule) => {
      if (rule.patterns.some((pattern) => pattern.test(value))) {
        result.add(rule.label);
      }
    });
  });

  if (result.has("Embedded Linux")) result.delete("Linux");
  if (result.has("ARM Cortex-M")) result.delete("ARM");

  return [...result];
}

export function extractTechnologyTagsFromText(raw: string | null | undefined): string[] {
  return normalizeTechnologyTags(raw);
}

export function mergeTechnologyTags(
  ...tagSets: Array<Array<string | null | undefined> | string | null | undefined>
): string[] {
  return normalizeTechnologyTags(tagSets.flatMap((entry) => (Array.isArray(entry) ? entry : [entry])));
}

export function buildTechnologyFrequencyMap(
  values: Array<string | null | undefined> | string | null | undefined,
): TechnologyFrequencyMap {
  const counts: TechnologyFrequencyMap = {};
  const inputs = Array.isArray(values) ? values : values ? [values] : [];
  inputs.forEach((value) => {
    normalizeTechnologyTags([value]).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return counts;
}

export function parseTechnologyFrequencyMap(value: unknown): TechnologyFrequencyMap {
  if (Array.isArray(value)) return buildTechnologyFrequencyMap(value as string[]);
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce<TechnologyFrequencyMap>((acc, [rawKey, rawValue]) => {
    const normalizedKey = normalizeTechnologyTag(rawKey);
    if (!normalizedKey) return acc;

    const nextCount = typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.max(0, Math.round(rawValue)) : 0;
    if (nextCount === 0) return acc;
    acc[normalizedKey] = (acc[normalizedKey] || 0) + nextCount;
    return acc;
  }, {});
}

export function getSortedTechnologyEntries(
  value: TechnologyFrequencyMap | Array<string | null | undefined> | string | null | undefined,
): Array<{ name: string; count: number }> {
  const frequencyMap = Array.isArray(value) || typeof value === "string"
    ? buildTechnologyFrequencyMap(value)
    : parseTechnologyFrequencyMap(value);

  return Object.entries(frequencyMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "nb");
    });
}
