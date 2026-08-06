import { describe, it, expect } from "vitest";
import {
  smoothedProbability,
  predictStopProbability,
  predictOnTimeProbability,
  predictFullness,
} from "./predictions-core";

const noWeather = { precipitationMm: null, windKmh: null, temperatureC: null };
const rainyWeather = { precipitationMm: 5, windKmh: 20, temperatureC: 10 };
const noCalendar = { isBankHoliday: false, isSchoolHoliday: false, isCollegeHoliday: false };
const bankHoliday = { isBankHoliday: true, isSchoolHoliday: false, isCollegeHoliday: false };
const schoolHoliday = { isBankHoliday: false, isSchoolHoliday: true, isCollegeHoliday: true };

describe("smoothedProbability", () => {
  it("returns prior when no votes", () => {
    expect(smoothedProbability(0, 0, 0.5, 2)).toBeCloseTo(0.5);
  });

  it("converges toward observed rate with many votes", () => {
    // 90 out of 100 positive — should be close to 0.9
    const p = smoothedProbability(90, 100, 0.5, 2);
    expect(p).toBeGreaterThan(0.87);
    expect(p).toBeLessThan(0.92);
  });

  it("unanimous positive pushes toward 1", () => {
    expect(smoothedProbability(10, 10, 0.5, 2)).toBeGreaterThan(0.8);
  });

  it("unanimous negative pushes toward 0", () => {
    expect(smoothedProbability(0, 10, 0.5, 2)).toBeLessThan(0.2);
  });

  it("handles tie (50/50)", () => {
    const p = smoothedProbability(5, 10, 0.5, 2);
    expect(p).toBeCloseTo(0.5, 1);
  });
});

describe("predictStopProbability", () => {
  it("returns high probability with no data (prior 0.8)", () => {
    const r = predictStopProbability({
      stopVotes: { positive: 0, total: 0 },
      fullEarlierOnRoute: 0,
      weather: noWeather,
      calendar: noCalendar,
    });
    expect(r.probability).toBeGreaterThan(0.7);
    expect(r.factors).toHaveLength(0);
  });

  it("penalises for full bus earlier on route", () => {
    const base = predictStopProbability({
      stopVotes: { positive: 0, total: 0 },
      fullEarlierOnRoute: 0,
      weather: noWeather,
      calendar: noCalendar,
    });
    const penalised = predictStopProbability({
      stopVotes: { positive: 0, total: 0 },
      fullEarlierOnRoute: 2,
      weather: noWeather,
      calendar: noCalendar,
    });
    expect(penalised.probability).toBeLessThan(base.probability);
    expect(penalised.factors).toContain("full 2 stops back");
  });

  it("adds bank holiday factor and boosts probability", () => {
    const base = predictStopProbability({
      stopVotes: { positive: 0, total: 0 },
      fullEarlierOnRoute: 0,
      weather: noWeather,
      calendar: noCalendar,
    });
    const holiday = predictStopProbability({
      stopVotes: { positive: 0, total: 0 },
      fullEarlierOnRoute: 0,
      weather: noWeather,
      calendar: bankHoliday,
    });
    expect(holiday.probability).toBeGreaterThan(base.probability);
    expect(holiday.factors).toContain("bank holiday");
  });

  it("probability stays within [0.01, 0.99]", () => {
    const r = predictStopProbability({
      stopVotes: { positive: 0, total: 100 },
      fullEarlierOnRoute: 10,
      weather: noWeather,
      calendar: noCalendar,
    });
    expect(r.probability).toBeGreaterThanOrEqual(0.01);
    expect(r.probability).toBeLessThanOrEqual(0.99);
  });
});

describe("predictOnTimeProbability", () => {
  it("returns moderate probability with no data (prior 0.6)", () => {
    const r = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
    });
    expect(r.probability).toBeGreaterThan(0.5);
    expect(r.factors).toHaveLength(0);
  });

  it("reduces probability in heavy rain", () => {
    const dry = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
    });
    const wet = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: rainyWeather,
      calendar: noCalendar,
    });
    expect(wet.probability).toBeLessThan(dry.probability);
    expect(wet.factors).toContain("rain");
  });

  it("bank holiday boosts on-time probability", () => {
    const normal = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
    });
    const holiday = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: bankHoliday,
    });
    expect(holiday.probability).toBeGreaterThan(normal.probability);
    expect(holiday.factors).toContain("bank holiday");
  });

  it("school holidays also boost on-time probability", () => {
    const normal = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
    });
    const school = predictOnTimeProbability({
      onTimeVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: schoolHoliday,
    });
    expect(school.probability).toBeGreaterThan(normal.probability);
    expect(school.factors).toContain("school holidays");
  });
});

describe("predictFullness", () => {
  it("returns low probability with no data (prior 0.3)", () => {
    const r = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
      hourOfDay: 14,
    });
    expect(r.probability).toBeLessThan(0.5);
    expect(r.factors).toHaveLength(0);
  });

  it("rain increases fullness probability", () => {
    const dry = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
      hourOfDay: 14,
    });
    const wet = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: rainyWeather,
      calendar: noCalendar,
      hourOfDay: 14,
    });
    expect(wet.probability).toBeGreaterThan(dry.probability);
    expect(wet.factors).toContain("rain");
  });

  it("school term rush hour increases fullness", () => {
    const offPeak = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
      hourOfDay: 14,
    });
    const rushHour = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
      hourOfDay: 8,
    });
    expect(rushHour.probability).toBeGreaterThan(offPeak.probability);
    expect(rushHour.factors).toContain("school term rush hour");
  });

  it("school holiday suppresses rush hour boost", () => {
    const termRush = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: noCalendar,
      hourOfDay: 8,
    });
    const holidayRush = predictFullness({
      fullVotes: { positive: 0, total: 0 },
      weather: noWeather,
      calendar: schoolHoliday,
      hourOfDay: 8,
    });
    expect(holidayRush.probability).toBeLessThan(termRush.probability);
    expect(holidayRush.factors).not.toContain("school term rush hour");
  });

  it("high vote majority yields high fullness probability", () => {
    const r = predictFullness({
      fullVotes: { positive: 20, total: 20 },
      weather: noWeather,
      calendar: noCalendar,
      hourOfDay: 14,
    });
    expect(r.probability).toBeGreaterThan(0.8);
  });
});
