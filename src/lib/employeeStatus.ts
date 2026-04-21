export type EmployeeLifecycleStatus = "Aktiv" | "Kommende" | "Sluttet";

export type EmployeeStatusLike = {
  status?: string | null;
  start_dato?: string | null;
  slutt_dato?: string | null;
};

function toDateOnly(value: string | Date): Date | null {
  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isEmployeeEndDatePassed(sluttDato?: string | null, today: Date = new Date()): boolean {
  if (!sluttDato) return false;
  const endDate = toDateOnly(sluttDato);
  const todayDate = toDateOnly(today);
  if (!endDate || !todayDate) return false;
  return endDate < todayDate;
}

export function isEmployeeStartDateFuture(startDato?: string | null, today: Date = new Date()): boolean {
  if (!startDato) return false;
  const startDate = toDateOnly(startDato);
  const todayDate = toDateOnly(today);
  if (!startDate || !todayDate) return false;
  return startDate > todayDate;
}

export function getEmployeeLifecycleStatus(
  employee: EmployeeStatusLike,
  today: Date = new Date(),
): EmployeeLifecycleStatus {
  if (employee.status === "SLUTTET" || isEmployeeEndDatePassed(employee.slutt_dato, today)) return "Sluttet";
  if (isEmployeeStartDateFuture(employee.start_dato, today)) return "Kommende";
  return "Aktiv";
}

export function getEmployeeDatabaseStatus(employee: Pick<EmployeeStatusLike, "slutt_dato">, today: Date = new Date()) {
  return isEmployeeEndDatePassed(employee.slutt_dato, today) ? "SLUTTET" : "AKTIV/SIGNERT";
}
