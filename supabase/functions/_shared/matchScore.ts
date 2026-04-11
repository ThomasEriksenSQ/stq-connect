import { normalizeTechnologyTags } from "./technologyTags.ts";

const DEFAULT_MAX_TAGS = 18;
const DIMINISHING_RETURNS = [1, 0.7, 0.45, 0.25, 0.1] as const;

type MatchLayer =
  | "bridge"
  | "stack"
  | "silicon"
  | "protocol"
  | "security"
  | "advanced"
  | "domain"
  | "foundation"
  | "support";

type TagProfile = {
  layer: MatchLayer;
  weight: number;
  family: string;
};

const DOMAIN_TAGS = new Set([
  "AI",
  "Automation",
  "Computer vision",
  "Cybersecurity",
  "Edge Computing",
  "GIS",
  "HIL",
  "Hardware Integration",
  "Robotics",
  "Safety",
  "Testing",
  "UAV",
]);

const FOUNDATION_TAGS = new Set([
  "C",
  "Embedded systems",
  "Electronics",
  "Firmware",
  "Linux",
  "RTOS",
]);

const SUPPORT_TAGS = new Set([
  "CI/CD",
  "Docker",
  "Git",
  "Jenkins",
  "Kubernetes",
  "Odoo",
  "Python",
]);

const TAG_PROFILES: Record<string, TagProfile> = {
  C: { layer: "foundation", weight: 0.3, family: "c-family" },
  "C++": { layer: "bridge", weight: 0.5, family: "c-family" },
  "Embedded systems": { layer: "foundation", weight: 0.25, family: "embedded-family" },
  Firmware: { layer: "foundation", weight: 0.25, family: "embedded-family" },
  RTOS: { layer: "foundation", weight: 0.25, family: "rtos-family" },
  Linux: { layer: "foundation", weight: 0.2, family: "linux-family" },
  Electronics: { layer: "foundation", weight: 0.15, family: "hardware-family" },

  "Embedded Linux": { layer: "stack", weight: 0.9, family: "linux-family" },
  Yocto: { layer: "stack", weight: 0.95, family: "build-family" },
  Qt: { layer: "stack", weight: 0.85, family: "ui-family" },
  FreeRTOS: { layer: "stack", weight: 0.85, family: "rtos-family" },
  Zephyr: { layer: "stack", weight: 0.85, family: "rtos-family" },
  NuttX: { layer: "stack", weight: 0.8, family: "rtos-family" },
  Buildroot: { layer: "stack", weight: 0.8, family: "build-family" },
  "Bare metal": { layer: "stack", weight: 0.75, family: "bringup-family" },
  "Device drivers": { layer: "stack", weight: 0.95, family: "driver-family" },
  "Device Tree": { layer: "stack", weight: 0.95, family: "driver-family" },
  "Board bring-up": { layer: "stack", weight: 0.9, family: "bringup-family" },
  "U-Boot": { layer: "stack", weight: 0.8, family: "boot-family" },
  CMake: { layer: "stack", weight: 0.55, family: "build-tool-family" },

  "ARM Cortex-M": { layer: "silicon", weight: 0.85, family: "arm-family" },
  ARM: { layer: "silicon", weight: 0.45, family: "arm-family" },
  Microcontrollers: { layer: "silicon", weight: 0.55, family: "mcu-family" },
  STM32: { layer: "silicon", weight: 0.9, family: "arm-family" },
  "Nordic nRF": { layer: "silicon", weight: 0.85, family: "nordic-family" },
  nRF52: { layer: "silicon", weight: 0.85, family: "nordic-family" },
  ESP32: { layer: "silicon", weight: 0.75, family: "esp-family" },
  "NXP i.MX": { layer: "silicon", weight: 0.85, family: "nxp-family" },

  CAN: { layer: "protocol", weight: 0.7, family: "can-family" },
  CANopen: { layer: "protocol", weight: 0.8, family: "can-family" },
  Modbus: { layer: "protocol", weight: 0.75, family: "modbus-family" },
  SPI: { layer: "protocol", weight: 0.55, family: "serial-bus-family" },
  I2C: { layer: "protocol", weight: 0.55, family: "serial-bus-family" },
  UART: { layer: "protocol", weight: 0.45, family: "uart-family" },
  RS232: { layer: "protocol", weight: 0.45, family: "uart-family" },
  RS485: { layer: "protocol", weight: 0.5, family: "uart-family" },
  BLE: { layer: "protocol", weight: 0.85, family: "ble-family" },
  Bluetooth: { layer: "protocol", weight: 0.55, family: "ble-family" },
  "Wi-Fi": { layer: "protocol", weight: 0.45, family: "wifi-family" },
  MQTT: { layer: "protocol", weight: 0.75, family: "messaging-family" },
  "TCP/IP": { layer: "protocol", weight: 0.6, family: "networking-family" },
  Sockets: { layer: "protocol", weight: 0.55, family: "networking-family" },
  Ethernet: { layer: "protocol", weight: 0.45, family: "ethernet-family" },
  "Ethernet/IP": { layer: "protocol", weight: 0.65, family: "ethernet-family" },
  Protobuf: { layer: "protocol", weight: 0.45, family: "messaging-family" },
  DDS: { layer: "protocol", weight: 0.55, family: "messaging-family" },
  LoRa: { layer: "protocol", weight: 0.6, family: "lora-family" },

  TrustZone: { layer: "security", weight: 0.9, family: "secure-platform-family" },
  "Secure boot": { layer: "security", weight: 0.9, family: "secure-platform-family" },
  "Secure storage": { layer: "security", weight: 0.8, family: "secure-platform-family" },
  Crypto: { layer: "security", weight: 0.75, family: "crypto-family" },
  Fuzzing: { layer: "security", weight: 0.75, family: "verification-family" },
  Sanitizers: { layer: "security", weight: 0.7, family: "verification-family" },

  FPGA: { layer: "advanced", weight: 0.9, family: "fpga-family" },
  ASIC: { layer: "advanced", weight: 0.85, family: "fpga-family" },
  VHDL: { layer: "advanced", weight: 0.85, family: "fpga-family" },
  Xilinx: { layer: "advanced", weight: 0.75, family: "fpga-family" },
  "Signal processing": { layer: "advanced", weight: 0.8, family: "signal-family" },
  "Sensor fusion": { layer: "advanced", weight: 0.75, family: "signal-family" },
  "Power management": { layer: "advanced", weight: 0.7, family: "power-family" },

  Python: { layer: "support", weight: 0.15, family: "support-family" },
  Git: { layer: "support", weight: 0.05, family: "support-family" },
  Docker: { layer: "support", weight: 0.05, family: "support-family" },
  Kubernetes: { layer: "support", weight: 0.05, family: "support-family" },
  Jenkins: { layer: "support", weight: 0.05, family: "support-family" },
  "CI/CD": { layer: "support", weight: 0.08, family: "support-family" },

  AI: { layer: "domain", weight: 0.15, family: "domain-family" },
  Automation: { layer: "domain", weight: 0.15, family: "domain-family" },
  "Computer vision": { layer: "domain", weight: 0.15, family: "domain-family" },
  Cybersecurity: { layer: "domain", weight: 0.12, family: "domain-family" },
  "Edge Computing": { layer: "domain", weight: 0.12, family: "domain-family" },
  GIS: { layer: "domain", weight: 0.15, family: "domain-family" },
  HIL: { layer: "domain", weight: 0.2, family: "domain-family" },
  "Hardware Integration": { layer: "domain", weight: 0.15, family: "domain-family" },
  Robotics: { layer: "domain", weight: 0.15, family: "domain-family" },
  Safety: { layer: "domain", weight: 0.2, family: "domain-family" },
  Testing: { layer: "domain", weight: 0.15, family: "domain-family" },
  UAV: { layer: "domain", weight: 0.15, family: "domain-family" },
};

const LAYER_PRIORITY: Record<MatchLayer, number> = {
  bridge: 0,
  stack: 1,
  silicon: 2,
  protocol: 3,
  security: 4,
  advanced: 5,
  domain: 6,
  foundation: 7,
  support: 8,
};

export type MatchBand = "strong" | "good" | "related";
export type ConfidenceBand = "low" | "medium" | "high";
export type MatchModelVersion = "legacy" | "stack_v1_1";

export interface MatchScoreResult {
  score10: number;
  matchBand: MatchBand | null;
  matchTags: string[];
  targetCoverage: number;
  sourceCoverage: number;
  matchedWeight: number;
  technicalFit: number;
  evidenceScore: number;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  matchedLayerCount: number;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function getTagProfile(tag: string): TagProfile {
  const profile = TAG_PROFILES[tag];
  if (profile) return profile;
  if (DOMAIN_TAGS.has(tag)) return { layer: "domain", weight: 0.15, family: "domain-family" };
  if (FOUNDATION_TAGS.has(tag)) return { layer: "foundation", weight: 0.2, family: "foundation-family" };
  if (SUPPORT_TAGS.has(tag)) return { layer: "support", weight: 0.08, family: "support-family" };
  return { layer: "support", weight: 0.25, family: `support:${tag}` };
}

function getTagWeight(tag: string): number {
  return getTagProfile(tag).weight;
}

function compareMatchingTags(left: string, right: string): number {
  const leftProfile = getTagProfile(left);
  const rightProfile = getTagProfile(right);

  if (leftProfile.layer !== rightProfile.layer) {
    return LAYER_PRIORITY[leftProfile.layer] - LAYER_PRIORITY[rightProfile.layer];
  }

  const weightDelta = rightProfile.weight - leftProfile.weight;
  if (weightDelta !== 0) return weightDelta;

  return left.localeCompare(right, "nb");
}

function getDiminishingFactor(index: number): number {
  return DIMINISHING_RETURNS[Math.min(index, DIMINISHING_RETURNS.length - 1)];
}

function getFamilyFactor(countInFamily: number): number {
  if (countInFamily === 0) return 1;
  if (countInFamily === 1) return 0.5;
  return 0.25;
}

function getWeightedTagSum(tags: string[]): number {
  const familyCounts = new Map<string, number>();

  return [...tags]
    .sort(compareMatchingTags)
    .reduce((sum, tag, index) => {
      const profile = getTagProfile(tag);
      const seenInFamily = familyCounts.get(profile.family) ?? 0;
      familyCounts.set(profile.family, seenInFamily + 1);
      return sum + profile.weight * getDiminishingFactor(index) * getFamilyFactor(seenInFamily);
    }, 0);
}

function getCategoryWeight(tags: string[], layer: MatchLayer): number {
  return tags.reduce((sum, tag) => {
    const profile = getTagProfile(tag);
    return profile.layer === layer ? sum + profile.weight : sum;
  }, 0);
}

function getCoreTags(tags: string[]): string[] {
  return tags.filter((tag) => {
    const layer = getTagProfile(tag).layer;
    return layer !== "domain" && layer !== "support";
  });
}

function getDistinctScoreLayers(tags: string[]): MatchLayer[] {
  return [...new Set(
    tags
      .map((tag) => getTagProfile(tag).layer)
      .filter((layer) => layer !== "domain" && layer !== "support"),
  )];
}

function getLayerCoverageScore(layerCount: number): number {
  if (layerCount >= 4) return 1;
  if (layerCount === 3) return 0.85;
  if (layerCount === 2) return 0.6;
  if (layerCount === 1) return 0.35;
  return 0;
}

function hasAnyTag(tags: string[], candidates: string[]): boolean {
  const tagSet = new Set(tags);
  return candidates.some((tag) => tagSet.has(tag));
}

function getCrossLayerBonus(tags: string[]): number {
  const matchedLayers = getDistinctScoreLayers(tags);
  const hasLinuxBase = hasAnyTag(tags, ["Embedded Linux"]);
  const hasLinuxBuild = hasAnyTag(tags, ["Yocto", "Buildroot"]);
  const hasLinuxApp = hasAnyTag(tags, ["Qt", "Device drivers", "Device Tree", "U-Boot"]);
  const hasBridge = hasAnyTag(tags, ["C++"]);
  const hasSilicon = hasAnyTag(tags, ["STM32", "ARM Cortex-M", "nRF52", "Nordic nRF", "ESP32", "NXP i.MX", "Microcontrollers"]);
  const hasRealtime = hasAnyTag(tags, ["FreeRTOS", "Zephyr", "NuttX", "RTOS", "Bare metal"]);
  const hasProtocol = hasAnyTag(tags, ["CAN", "CANopen", "Modbus", "BLE", "MQTT", "TCP/IP", "Sockets"]);
  const hasSecurity = hasAnyTag(tags, ["TrustZone", "Secure boot", "Secure storage", "Crypto", "Fuzzing", "Sanitizers"]);
  const hasBringup = hasAnyTag(tags, ["Board bring-up", "U-Boot", "Device Tree", "Device drivers"]);

  let bonus = 0;
  if (hasLinuxBase && hasLinuxBuild && hasLinuxApp) bonus += 0.12;
  if (hasBridge && hasLinuxBuild && hasAnyTag(tags, ["Qt", "Embedded Linux"])) bonus += 0.1;
  if (hasSilicon && hasRealtime && hasProtocol) bonus += 0.12;
  if (hasSecurity && (hasLinuxBase || hasSilicon || hasAnyTag(tags, ["C++"])) && matchedLayers.length >= 3) bonus += 0.1;
  if (hasBringup && hasLinuxBase && (hasLinuxBuild || hasAnyTag(tags, ["U-Boot"]))) bonus += 0.08;
  if (matchedLayers.length >= 3) bonus += 0.05;

  return Math.min(0.22, bonus);
}

function getEvidenceBand(params: {
  matchTags: string[];
  targetTags: string[];
  sourceTags: string[];
  matchedLayerCount: number;
  crossLayerBonus: number;
}): ConfidenceBand {
  const matchedCoreTags = getCoreTags(params.matchTags);
  const hasMeaningfulStack = matchedCoreTags.some((tag) => {
    const layer = getTagProfile(tag).layer;
    return layer === "stack" || layer === "protocol" || layer === "silicon" || layer === "security" || layer === "advanced";
  });
  const onlyFoundationLike = matchedCoreTags.length > 0 && matchedCoreTags.every((tag) => {
    const layer = getTagProfile(tag).layer;
    return layer === "foundation" || layer === "bridge";
  });

  if (params.matchTags.length <= 1 || onlyFoundationLike || !hasMeaningfulStack) {
    return "low";
  }

  if (matchedCoreTags.length >= 3 && params.matchedLayerCount >= 2 && params.crossLayerBonus >= 0.1) {
    return "high";
  }

  if (matchedCoreTags.length >= 3 || hasMeaningfulStack) {
    return "medium";
  }

  return "low";
}

function getEvidenceScore(params: {
  confidenceBand: ConfidenceBand;
  matchedLayerCount: number;
  targetCoreCount: number;
  sourceCoreCount: number;
  crossLayerBonus: number;
}): number {
  const cap =
    params.confidenceBand === "high"
      ? 0.95
      : params.confidenceBand === "medium"
        ? 0.8
        : 0.6;

  let score =
    params.confidenceBand === "high"
      ? 0.9
      : params.confidenceBand === "medium"
        ? 0.72
        : 0.56;

  if (params.matchedLayerCount >= 2) score += 0.04;
  if (params.matchedLayerCount >= 3) score += 0.04;
  if (params.targetCoreCount >= 4 && params.sourceCoreCount >= 4) score += 0.03;
  if (params.crossLayerBonus >= 0.1) score += 0.03;

  return clamp(score, 0, cap);
}

export function normalizeScoredMatchTags(
  values: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): string[] {
  return normalizeTechnologyTags(values)
    .sort(compareMatchingTags)
    .slice(0, maxTags);
}

export function getMatchBand(score10: number): MatchBand | null {
  if (score10 >= 8) return "strong";
  if (score10 >= 6) return "good";
  if (score10 >= 4) return "related";
  return null;
}

export function getMatchBandRank(band: MatchBand | null): number {
  if (band === "strong") return 3;
  if (band === "good") return 2;
  if (band === "related") return 1;
  return 0;
}

function getLegacyCanonicalMatchScore(
  targetValues: Array<string | null | undefined> | string | null | undefined,
  sourceValues: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
): MatchScoreResult {
  const targetTags = normalizeScoredMatchTags(targetValues, maxTags);
  const sourceTags = normalizeScoredMatchTags(sourceValues, maxTags);

  if (targetTags.length === 0 || sourceTags.length === 0) {
    return {
      score10: 0,
      matchBand: null,
      matchTags: [],
      targetCoverage: 0,
      sourceCoverage: 0,
      matchedWeight: 0,
      technicalFit: 0,
      evidenceScore: 0,
      confidenceScore: 0,
      confidenceBand: "low",
      matchedLayerCount: 0,
    };
  }

  const sourceTagSet = new Set(sourceTags);
  const matchTags = targetTags.filter((tag) => sourceTagSet.has(tag));

  if (matchTags.length === 0) {
    return {
      score10: 0,
      matchBand: null,
      matchTags: [],
      targetCoverage: 0,
      sourceCoverage: 0,
      matchedWeight: 0,
      technicalFit: 0,
      evidenceScore: 0,
      confidenceScore: 0,
      confidenceBand: "low",
      matchedLayerCount: 0,
    };
  }

  const targetWeight = getWeightedTagSum(targetTags);
  const sourceWeight = getWeightedTagSum(sourceTags);
  const matchedWeight = getWeightedTagSum(matchTags);
  const targetCoverage = targetWeight > 0 ? matchedWeight / targetWeight : 0;
  const sourceCoverage = sourceWeight > 0 ? matchedWeight / sourceWeight : 0;

  const targetDomainWeight = getCategoryWeight(targetTags, "domain");
  const sourceDomainWeight = getCategoryWeight(sourceTags, "domain");
  const matchedDomainWeight = getCategoryWeight(matchTags, "domain");
  const targetCoreWeight = getWeightedTagSum(getCoreTags(targetTags));
  const sourceCoreWeight = getWeightedTagSum(getCoreTags(sourceTags));
  const matchedCoreWeight = getWeightedTagSum(getCoreTags(matchTags));

  const targetCoreCoverage = targetCoreWeight > 0 ? matchedCoreWeight / targetCoreWeight : 0;
  const sourceCoreCoverage = sourceCoreWeight > 0 ? matchedCoreWeight / sourceCoreWeight : 0;
  const domainTargetCoverage = targetDomainWeight > 0 ? matchedDomainWeight / targetDomainWeight : 0;
  const domainSourceCoverage = sourceDomainWeight > 0 ? matchedDomainWeight / sourceDomainWeight : 0;

  let technicalFit =
    targetCoverage * 0.5 +
    sourceCoverage * 0.15 +
    targetCoreCoverage * 0.2 +
    sourceCoreCoverage * 0.05 +
    domainTargetCoverage * 0.05 +
    domainSourceCoverage * 0.05;

  if (matchedCoreWeight >= 2) technicalFit += 0.08;
  if (matchedDomainWeight > 0) technicalFit += 0.04;

  const normalizedFit = clamp(technicalFit);
  const score10 = Math.round(normalizedFit * 10);

  return {
    score10,
    matchBand: getMatchBand(score10),
    matchTags,
    targetCoverage,
    sourceCoverage,
    matchedWeight,
    technicalFit: normalizedFit,
    evidenceScore: 1,
    confidenceScore: 1,
    confidenceBand: "high",
    matchedLayerCount: getDistinctScoreLayers(matchTags).length,
  };
}

export function getCanonicalMatchScore(
  targetValues: Array<string | null | undefined> | string | null | undefined,
  sourceValues: Array<string | null | undefined> | string | null | undefined,
  maxTags = DEFAULT_MAX_TAGS,
  options?: {
    model?: MatchModelVersion;
  },
): MatchScoreResult {
  if ((options?.model || "stack_v1_1") === "legacy") {
    return getLegacyCanonicalMatchScore(targetValues, sourceValues, maxTags);
  }

  const targetTags = normalizeScoredMatchTags(targetValues, maxTags);
  const sourceTags = normalizeScoredMatchTags(sourceValues, maxTags);

  if (targetTags.length === 0 || sourceTags.length === 0) {
    return {
      score10: 0,
      matchBand: null,
      matchTags: [],
      targetCoverage: 0,
      sourceCoverage: 0,
      matchedWeight: 0,
      technicalFit: 0,
      evidenceScore: 0,
      confidenceScore: 0,
      confidenceBand: "low",
      matchedLayerCount: 0,
    };
  }

  const sourceTagSet = new Set(sourceTags);
  const matchTags = targetTags.filter((tag) => sourceTagSet.has(tag));

  if (matchTags.length === 0) {
    return {
      score10: 0,
      matchBand: null,
      matchTags: [],
      targetCoverage: 0,
      sourceCoverage: 0,
      matchedWeight: 0,
      technicalFit: 0,
      evidenceScore: 0,
      confidenceScore: 0,
      confidenceBand: "low",
      matchedLayerCount: 0,
    };
  }

  const targetWeight = getWeightedTagSum(targetTags);
  const sourceWeight = getWeightedTagSum(sourceTags);
  const matchedWeight = getWeightedTagSum(matchTags);
  const targetCoverage = targetWeight > 0 ? matchedWeight / targetWeight : 0;
  const sourceCoverage = sourceWeight > 0 ? matchedWeight / sourceWeight : 0;

  const targetCoreTags = getCoreTags(targetTags);
  const sourceCoreTags = getCoreTags(sourceTags);
  const matchedCoreTags = getCoreTags(matchTags);
  const targetCoreWeight = getWeightedTagSum(targetCoreTags);
  const sourceCoreWeight = getWeightedTagSum(sourceCoreTags);
  const matchedCoreWeight = getWeightedTagSum(matchedCoreTags);
  const coreTargetCoverage = targetCoreWeight > 0 ? matchedCoreWeight / targetCoreWeight : 0;
  const matchedLayerCount = getDistinctScoreLayers(matchTags).length;
  const layerCoverage = getLayerCoverageScore(matchedLayerCount);
  const crossLayerBonus = getCrossLayerBonus(matchTags);

  const technicalFit = clamp(
    targetCoverage * 0.55 +
      sourceCoverage * 0.15 +
      coreTargetCoverage * 0.15 +
      layerCoverage * 0.1 +
      crossLayerBonus,
  );

  const confidenceBand = getEvidenceBand({
    matchTags,
    targetTags,
    sourceTags,
    matchedLayerCount,
    crossLayerBonus,
  });
  const evidenceScore = getEvidenceScore({
    confidenceBand,
    matchedLayerCount,
    targetCoreCount: targetCoreTags.length,
    sourceCoreCount: sourceCoreTags.length,
    crossLayerBonus,
  });
  const score10 = Math.round(clamp(technicalFit * evidenceScore) * 10);

  return {
    score10,
    matchBand: getMatchBand(score10),
    matchTags,
    targetCoverage,
    sourceCoverage,
    matchedWeight,
    technicalFit,
    evidenceScore,
    confidenceScore: evidenceScore,
    confidenceBand,
    matchedLayerCount,
  };
}
