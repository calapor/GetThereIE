import { describe, it, expect } from "vitest";
import { getCalendarContext } from "./calendar-ie";

function d(s: string) {
  return new Date(s + "T12:00:00Z");
}

describe("getCalendarContext", () => {
  it("marks New Year 2026 as a bank holiday", () => {
    const ctx = getCalendarContext(d("2026-01-01"));
    expect(ctx.isBankHoliday).toBe(true);
    expect(ctx.label).toContain("bank holiday");
  });

  it("marks St Patrick's Day 2026 as a bank holiday", () => {
    expect(getCalendarContext(d("2026-03-17")).isBankHoliday).toBe(true);
  });

  it("marks a regular weekday in school term as not a holiday", () => {
    const ctx = getCalendarContext(d("2026-01-20")); // mid-Jan, school in session
    expect(ctx.isBankHoliday).toBe(false);
    expect(ctx.isSchoolHoliday).toBe(false);
  });

  it("marks mid-summer as school holiday", () => {
    const ctx = getCalendarContext(d("2026-07-15"));
    expect(ctx.isSchoolHoliday).toBe(true);
  });

  it("marks mid-summer as college holiday", () => {
    const ctx = getCalendarContext(d("2026-07-15"));
    expect(ctx.isCollegeHoliday).toBe(true);
  });

  it("marks a college term date as not a college holiday", () => {
    const ctx = getCalendarContext(d("2026-02-01")); // spring semester
    expect(ctx.isCollegeHoliday).toBe(false);
  });

  it("returns an empty label on a normal school/college day", () => {
    // Mid-January 2026: school in, college in, not a bank holiday
    const ctx = getCalendarContext(d("2026-01-20"));
    expect(ctx.label).toBe("");
  });

  it("Christmas Day is a bank holiday and school holiday", () => {
    const ctx = getCalendarContext(d("2026-12-25"));
    expect(ctx.isBankHoliday).toBe(true);
    expect(ctx.isSchoolHoliday).toBe(true);
  });

  it("mid-October half-term is a school holiday", () => {
    const ctx = getCalendarContext(d("2026-10-28")); // after Oct 23 break starts
    expect(ctx.isSchoolHoliday).toBe(true);
  });
});
