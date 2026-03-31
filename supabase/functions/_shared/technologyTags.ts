export type TechnologyFrequencyMap = Record<string, number>;

type TechnologyRule = {
  label: string;
  patterns: RegExp[];
};

const TECHNOLOGY_RULES: TechnologyRule[] = [
  { label: "C++", patterns: [/^c\+\+$/i, /\bc\+\+\b/i, /\bmodern c\+\+\b/i] },
  { label: "C", patterns: [/^c$/i, /^ansi c$/i, /^embedded c$/i] },
  { label: "Rust", patterns: [/^rust$/i, /\brust\b/i] },
  { label: "Python", patterns: [/^python$/i, /\bpython\b/i] },
  { label: "Qt", patterns: [/^qt$/i, /\bqt\b/i, /^qt\/qml$/i, /\bqml\b/i] },
  { label: "CMake", patterns: [/^cmake$/i, /\bcmake\b/i] },
  { label: "Yocto", patterns: [/^yocto$/i, /\byocto\b/i] },
  { label: "Buildroot", patterns: [/^buildroot$/i, /\bbuildroot\b/i] },
  { label: "Embedded Linux", patterns: [/^embedded linux$/i, /\bembedded linux\b/i] },
  { label: "Linux", patterns: [/^linux$/i, /(^|[^a-z])linux([^a-z]|$)/i] },
  { label: "Zephyr", patterns: [/^zephyr$/i, /\bzephyr\b/i] },
  { label: "FreeRTOS", patterns: [/^freertos$/i, /^free rtos$/i, /\bfreertos\b/i, /\bfree rtos\b/i] },
  { label: "NuttX", patterns: [/^nuttx$/i, /\bnuttx\b/i] },
  { label: "RTOS", patterns: [/^rtos$/i, /\brtos\b/i] },
  { label: "Bare metal", patterns: [/^bare metal$/i, /\bbare[- ]metal\b/i] },
  { label: "Firmware", patterns: [/^firmware$/i, /\bfirmware\b/i] },
  { label: "Embedded systems", patterns: [/^embedded$/i, /^embedded systems?$/i, /\bembedded systems?\b/i] },
  { label: "Device drivers", patterns: [/^device drivers?$/i, /\bdevice drivers?\b/i, /\bkernel modules?\b/i] },
  { label: "FPGA", patterns: [/^fpga$/i, /\bfpga\b/i] },
  { label: "ASIC", patterns: [/^asic$/i, /\basic\b/i] },
  { label: "ARM Cortex-M", patterns: [/^arm cortex m$/i, /^cortex m$/i, /\barm cortex-m\b/i, /\bcortex-m\b/i] },
  { label: "Microcontrollers", patterns: [/^microcontrollers?$/i, /\bmicrocontrollers?\b/i] },
  { label: "ARM", patterns: [/^arm$/i, /^arm32$/i, /^arm64$/i, /\barm\b/i] },
  { label: "STM32", patterns: [/^stm32$/i, /\bstm32\b/i] },
  { label: "nRF52", patterns: [/^nrf52$/i, /\bnrf52\b/i] },
  { label: "ESP32", patterns: [/^esp32$/i, /\besp32\b/i] },
  { label: "CAN", patterns: [/^can$/i, /^can bus$/i, /\bcan bus\b/i] },
  { label: "SPI", patterns: [/^spi$/i, /\bspi\b/i] },
  { label: "I2C", patterns: [/^i2c$/i, /\bi2c\b/i] },
  { label: "UART", patterns: [/^uart$/i, /\buart\b/i] },
  { label: "BLE", patterns: [/^ble$/i, /^bluetooth low energy$/i, /\bbluetooth low energy\b/i] },
  { label: "Bluetooth", patterns: [/^bluetooth$/i, /\bbluetooth\b/i] },
  { label: "Wi-Fi", patterns: [/^wifi$/i, /^wi-fi$/i, /\bwi[ -]?fi\b/i] },
  { label: "MQTT", patterns: [/^mqtt$/i, /\bmqtt\b/i] },
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
];

const IGNORED_VALUES = new Set(["", "-", "n/a", "na", "none", "ukjent", "annet"]);

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

export function normalizeTechnologyTag(token: string | null | undefined): string | null {
  const cleaned = sanitizeToken(String(token || ""));
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  if (IGNORED_VALUES.has(lower)) return null;

  for (const rule of TECHNOLOGY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(cleaned))) {
      return rule.label;
    }
  }

  if (lower.length < 2) return null;
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

export function mergeTechnologyTags(
  ...tagSets: Array<Array<string | null | undefined> | string | null | undefined>
): string[] {
  return normalizeTechnologyTags(tagSets.flatMap((entry) => (Array.isArray(entry) ? entry : [entry])));
}

export function buildTechnologyFrequencyMap(values: Array<string | null | undefined>): TechnologyFrequencyMap {
  const counts: TechnologyFrequencyMap = {};
  values.forEach((value) => {
    normalizeTechnologyTags([value]).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return counts;
}
