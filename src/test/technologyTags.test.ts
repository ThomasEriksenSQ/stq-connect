import { describe, expect, it } from "vitest";

import {
  extractTechnologyTagsFromText,
  getSortedTechnologyEntries,
  mergeTechnologyTags,
  normalizeTechnologyTags,
} from "@/lib/technologyTags";

describe("technologyTags", () => {
  it("normalizes embedded aliases to canonical tags", () => {
    expect(
      normalizeTechnologyTags([
        "c/c++",
        "embedded linux",
        "freertos",
        "arm cortex-m",
        "stm32",
      ]),
    ).toEqual(["C", "C++", "Embedded Linux", "FreeRTOS", "ARM Cortex-M", "STM32"]);
  });

  it("extracts nested and compound technologies from text", () => {
    const extracted = extractTechnologyTagsFromText("C++, Embedded Linux (Yocto, Qt/QML), SPI/I2C, BLE");
    expect(extracted).toHaveLength(7);
    expect(extracted).toEqual(expect.arrayContaining(["C++", "Embedded Linux", "Yocto", "Qt", "SPI", "I2C", "BLE"]));
  });

  it("keeps canonical slash tags and removes generic protocol noise", () => {
    const extracted = extractTechnologyTagsFromText("CI/CD, Communication Protocols (modbus, Can, Ethernet/ip)");
    expect(extracted).toEqual(expect.arrayContaining(["CI/CD", "Modbus", "Ethernet/IP"]));
    expect(extracted).not.toContain("CI");
    expect(extracted).not.toContain("CD");
    expect(extracted).not.toContain("Communication Protocols");
  });

  it("merges and de-duplicates technologies across sources", () => {
    expect(
      mergeTechnologyTags(["c++", "Yocto"], ["C++", "embedded linux"], "Qt/QML, Yocto"),
    ).toEqual(["C++", "Yocto", "Embedded Linux", "Qt"]);
  });

  it("normalizes norwegian and broad embedded variants into canonical tags", () => {
    expect(
      normalizeTechnologyTags([
        "mikrokontroller",
        "Kernel Drivers",
        "Real-time systems",
      ]),
    ).toEqual(["Microcontrollers", "Device drivers", "RTOS"]);
  });

  it("filters noisy free-text phrases while preserving useful domain tags", () => {
    const extracted = normalizeTechnologyTags([
      "Automation * Flashing * Factory Acceptance Tests * Integrasjon Mot Erp-suite (netsuite",
      "Geospatial Data And C++",
      "Maps",
      "Packaging/deployment for UAV hardware",
      "Bear Metal As A Service",
      "Osv..",
    ]);

    expect(extracted).toEqual(expect.arrayContaining(["Automation", "GIS", "C++", "UAV"]));
    expect(extracted).not.toContain("Bear Metal As A Service");
    expect(extracted).not.toContain("Geospatial Data And C++");
    expect(extracted).not.toContain("Automation * Flashing * Factory Acceptance Tests * Integrasjon Mot Erp-suite (netsuite");
    expect(extracted).not.toContain("Osv..");
  });

  it("salvages concrete technologies from noisy mixed phrases", () => {
    expect(
      normalizeTechnologyTags([
        "VHDL og kanskje har litt erfaring med Xilinx SoC",
        "Nordic semi sin nrf9x-serie",
        "Bootloaders (u-boot",
      ]),
    ).toEqual(expect.arrayContaining(["VHDL", "Xilinx", "Nordic nRF", "U-Boot"]));
  });

  it("normalizes concrete embedded stack and security chips", () => {
    expect(
      normalizeTechnologyTags([
        "board bringup",
        "device tree",
        "secure boot",
        "trustzone",
        "canopen",
        "i.MX8",
      ]),
    ).toEqual(expect.arrayContaining([
      "Board bring-up",
      "Device Tree",
      "Secure boot",
      "TrustZone",
      "CANopen",
      "NXP i.MX",
    ]));
  });

  it("sorts parsed frequency maps by count", () => {
    expect(
      getSortedTechnologyEntries({
        "embedded linux": 2,
        Yocto: 4,
        C: 1,
      }),
    ).toEqual([
      { name: "Yocto", count: 4 },
      { name: "Embedded Linux", count: 2 },
      { name: "C", count: 1 },
    ]);
  });
});
