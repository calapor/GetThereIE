import { describe, it, expect } from "vitest";
import { computeBonus } from "./points-core";

describe("computeBonus", () => {
  it("awards only base points below the majority threshold", () => {
    expect(computeBonus([true, true], true)).toEqual({ awarded: 5, multiplier: null });
  });
  it("awards bonus when the vote matches the majority (>=3 votes)", () => {
    // 3 votes, 2 up -> majority is 'up'; user voted up
    expect(computeBonus([true, true, false], true)).toEqual({ awarded: 15, multiplier: 3 });
  });
  it("awards no bonus when the vote is against the majority", () => {
    expect(computeBonus([true, true, false], false)).toEqual({ awarded: 5, multiplier: null });
  });
  it("treats an exact tie as majority=false", () => {
    // 4 votes, 2 up -> upVotes(2) > 2 is false -> majority 'down'
    expect(computeBonus([true, true, false, false], false)).toEqual({ awarded: 15, multiplier: 3 });
  });
});
