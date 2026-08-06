export interface CalendarContext {
  isBankHoliday: boolean;
  isSchoolHoliday: boolean;
  isCollegeHoliday: boolean;
  label: string;
}

// IE public holidays — covers 2025–2026
const bankHolidays = new Set([
  "2025-01-01",
  "2025-02-03",
  "2025-03-17",
  "2025-04-21",
  "2025-05-05",
  "2025-06-02",
  "2025-08-04",
  "2025-10-27",
  "2025-12-25",
  "2025-12-26",
  "2026-01-01",
  "2026-02-02",
  "2026-03-17",
  "2026-04-06",
  "2026-05-04",
  "2026-06-01",
  "2026-08-03",
  "2026-10-26",
  "2026-12-25",
  "2026-12-26",
]);

// Primary/secondary school terms (dates when school IS in session)
const schoolTerms = [
  { start: "2025-01-06", end: "2025-02-14" },
  { start: "2025-02-24", end: "2025-04-11" },
  { start: "2025-04-28", end: "2025-06-27" },
  { start: "2025-09-01", end: "2025-10-24" },
  { start: "2025-11-03", end: "2025-12-19" },
  { start: "2026-01-06", end: "2026-02-13" },
  { start: "2026-02-23", end: "2026-04-03" },
  { start: "2026-04-20", end: "2026-05-29" },
  { start: "2026-09-01", end: "2026-10-23" },
  { start: "2026-11-02", end: "2026-12-18" },
];

// Third-level college terms (dates when college IS in session)
const collegeTerms = [
  { start: "2025-01-13", end: "2025-04-30" },
  { start: "2025-09-08", end: "2025-12-19" },
  { start: "2026-01-12", end: "2026-04-03" },
  { start: "2026-09-07", end: "2026-12-18" },
];

function inRange(dateStr: string, ranges: { start: string; end: string }[]): boolean {
  return ranges.some((r) => dateStr >= r.start && dateStr <= r.end);
}

// dateStr format: "YYYY-MM-DD"
function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getCalendarContext(date: Date): CalendarContext {
  const ds = toDateStr(date);
  const isBankHoliday = bankHolidays.has(ds);
  const isSchoolHoliday = !inRange(ds, schoolTerms);
  const isCollegeHoliday = !inRange(ds, collegeTerms);

  const labels: string[] = [];
  if (isBankHoliday) labels.push("bank holiday");
  if (isSchoolHoliday) labels.push("school holidays");
  if (isCollegeHoliday) labels.push("college holidays");

  return {
    isBankHoliday,
    isSchoolHoliday,
    isCollegeHoliday,
    label: labels.join(" · "),
  };
}
