import { describe, it, expect } from "vitest";
import { getNorwegianHolidays, countNorwegianWorkdays } from "@/lib/norwegianHolidays";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("getNorwegianHolidays", () => {
  it("inkluderer faste fridager", () => {
    const days = getNorwegianHolidays(2025).map(iso);
    expect(days).toContain("2025-01-01");
    expect(days).toContain("2025-05-01");
    expect(days).toContain("2025-05-17");
    expect(days).toContain("2025-12-25");
    expect(days).toContain("2025-12-26");
  });

  it("beregner påsken 2025 (20. april)", () => {
    const days = getNorwegianHolidays(2025).map(iso);
    expect(days).toContain("2025-04-17"); // Skjærtorsdag
    expect(days).toContain("2025-04-18"); // Langfredag
    expect(days).toContain("2025-04-20"); // 1. påskedag
    expect(days).toContain("2025-04-21"); // 2. påskedag
    expect(days).toContain("2025-05-29"); // Kr.h.farts (påske + 39)
    expect(days).toContain("2025-06-08"); // 1. pinsedag
    expect(days).toContain("2025-06-09"); // 2. pinsedag
  });

  it("beregner påsken 2026 (5. april)", () => {
    const days = getNorwegianHolidays(2026).map(iso);
    expect(days).toContain("2026-04-02"); // Skjærtorsdag
    expect(days).toContain("2026-04-03"); // Langfredag
    expect(days).toContain("2026-04-05"); // 1. påskedag
    expect(days).toContain("2026-04-06"); // 2. påskedag
  });
});

describe("countNorwegianWorkdays", () => {
  it("trekker fra røde dager i mai 2025", () => {
    // Mai 2025: 22 hverdager (mandag–fredag).
    // Røde hverdager: 1. mai (tor), 29. mai Kr.h.farts (tor). 17. mai = lør (allerede ekskl).
    expect(countNorwegianWorkdays(2025, 4)).toBe(20);
  });

  it("trekker fra påskeuken i april 2026", () => {
    // April 2026: 22 hverdager. Røde hverdager: skjærtors 2/4, langfre 3/4, 2. påskedag man 6/4.
    expect(countNorwegianWorkdays(2026, 3)).toBe(19);
  });

  it("returnerer 22 for en måned uten røde dager (mars 2025)", () => {
    // Mars 2025: 21 hverdager, ingen røde dager.
    expect(countNorwegianWorkdays(2025, 2)).toBe(21);
  });
});
