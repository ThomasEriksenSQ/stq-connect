/**
 * Norske offentlige fridager (røde dager).
 *
 * Beregner faste og bevegelige fridager. Bevegelige dager utledes fra
 * påskedag via Anonymous Gregorian-algoritmen (Meeus/Jones/Butcher).
 */

/** Returnerer påskedag (søndag) for et gitt år som lokal Date. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = april
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returnerer alle norske offentlige fridager for året.
 */
export function getNorwegianHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  return [
    new Date(year, 0, 1),         // Nyttårsdag
    addDays(easter, -3),          // Skjærtorsdag
    addDays(easter, -2),          // Langfredag
    easter,                       // 1. påskedag
    addDays(easter, 1),           // 2. påskedag
    new Date(year, 4, 1),         // Off. høytidsdag (1. mai)
    new Date(year, 4, 17),        // Grunnlovsdagen (17. mai)
    addDays(easter, 39),          // Kristi himmelfartsdag
    addDays(easter, 49),          // 1. pinsedag
    addDays(easter, 50),          // 2. pinsedag
    new Date(year, 11, 25),       // 1. juledag
    new Date(year, 11, 26),       // 2. juledag
  ];
}

/**
 * Returnerer antall faktiske arbeidsdager (man–fre) i en måned,
 * minus norske røde dager som faller på en hverdag.
 *
 * @param year  Kalenderår, f.eks. 2026
 * @param month Måned 0-indeksert (0 = januar, 11 = desember)
 */
export function countNorwegianWorkdays(year: number, month: number): number {
  const holidaySet = new Set(
    getNorwegianHolidays(year)
      .filter((d) => d.getFullYear() === year && d.getMonth() === month)
      .map((d) => d.getDate())
  );

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month, day).getDay();
    if (dow === 0 || dow === 6) continue;
    if (holidaySet.has(day)) continue;
    count++;
  }
  return count;
}
