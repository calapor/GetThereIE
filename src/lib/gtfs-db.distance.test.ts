import { describe, it, expect } from "vitest";
import { haversineMeters } from "./gtfs-db";

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters(53.349, -6.26, 53.349, -6.26)).toBe(0);
  });
  it("approximates a known Dublin distance", () => {
    // O'Connell Bridge -> St Stephen's Green, ~900m
    const m = haversineMeters(53.3472, -6.2593, 53.3382, -6.2591);
    expect(m).toBeGreaterThan(800);
    expect(m).toBeLessThan(1100);
  });
});
