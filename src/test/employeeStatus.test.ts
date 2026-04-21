import { describe, expect, it } from "vitest";

import {
  getEmployeeDatabaseStatus,
  getEmployeeLifecycleStatus,
  isEmployeeEndDatePassed,
} from "@/lib/employeeStatus";

const TODAY = new Date("2026-04-21T12:00:00");

describe("employeeStatus", () => {
  it("marks employees as ended when end date is in the past", () => {
    expect(isEmployeeEndDatePassed("2026-04-20", TODAY)).toBe(true);
    expect(isEmployeeEndDatePassed("2026-04-21", TODAY)).toBe(false);
    expect(getEmployeeLifecycleStatus({ slutt_dato: "2026-04-20" }, TODAY)).toBe("Sluttet");
    expect(getEmployeeDatabaseStatus({ slutt_dato: "2026-04-20" }, TODAY)).toBe("SLUTTET");
  });

  it("uses start date to distinguish upcoming from active employees", () => {
    expect(getEmployeeLifecycleStatus({ start_dato: "2026-04-22" }, TODAY)).toBe("Kommende");
    expect(getEmployeeLifecycleStatus({ start_dato: "2026-04-21" }, TODAY)).toBe("Aktiv");
    expect(getEmployeeLifecycleStatus({ start_dato: "2026-04-20" }, TODAY)).toBe("Aktiv");
  });

  it("keeps old manual ended statuses as ended", () => {
    expect(getEmployeeLifecycleStatus({ status: "SLUTTET" }, TODAY)).toBe("Sluttet");
    expect(getEmployeeDatabaseStatus({ slutt_dato: null }, TODAY)).toBe("AKTIV/SIGNERT");
  });
});
