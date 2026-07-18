import { describe, it, expect } from "vitest";
import { scheduledToUnix, fmtTime, minutesUntil, delayToMinutes } from "./time";

describe("scheduledToUnix + fmtTime", () => {
  it("round-trips a scheduled arrival back to HH:MM", () => {
    const secs = 8 * 3600 + 5 * 60; // 08:05
    const ts = scheduledToUnix(secs, "20260101");
    expect(fmtTime(ts)).toBe("08:05");
  });
  it("pads single-digit hours and minutes", () => {
    const ts = scheduledToUnix(9 * 60, "20260101"); // 00:09
    expect(fmtTime(ts)).toBe("00:09");
  });
});

describe("minutesUntil", () => {
  it("floors whole minutes", () => {
    expect(minutesUntil(1000 + 179, 1000)).toBe(2); // 179s -> 2 min
  });
  it("never returns negative", () => {
    expect(minutesUntil(1000, 2000)).toBe(0);
  });
});

describe("delayToMinutes", () => {
  it("rounds to nearest minute", () => {
    expect(delayToMinutes(90)).toBe(2);
    expect(delayToMinutes(-90)).toBe(-1); // Math.round(-1.5) === -1
    expect(delayToMinutes(20)).toBe(0);
  });
});
