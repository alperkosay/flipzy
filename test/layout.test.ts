import { describe, expect, it } from "vitest";
import { buildSpreads, clampInt, clampNumber, firstPageOfSpread, spreadIndexOfPage } from "../src/layout";

describe("buildSpreads", () => {
  it("puts the cover alone on the right in double mode", () => {
    expect(buildSpreads(6, "double", true)).toEqual([
      { left: null, right: 0 },
      { left: 1, right: 2 },
      { left: 3, right: 4 },
      { left: 5, right: null },
    ]);
  });

  it("pairs pages from the start without a cover", () => {
    expect(buildSpreads(3, "double", false)).toEqual([
      { left: 0, right: 1 },
      { left: 2, right: null },
    ]);
  });

  it("shows one page per spread in single mode", () => {
    expect(buildSpreads(2, "single", true)).toEqual([
      { left: null, right: 0 },
      { left: null, right: 1 },
    ]);
  });

  it("handles empty books", () => {
    expect(buildSpreads(0, "double", true)).toEqual([]);
  });
});

describe("spreadIndexOfPage", () => {
  it("maps every page to the spread that shows it", () => {
    for (const showCover of [true, false]) {
      const spreads = buildSpreads(9, "double", showCover);
      for (let p = 0; p < 9; p++) {
        const s = spreads[spreadIndexOfPage(p, "double", showCover)]!;
        expect([s.left, s.right]).toContain(p);
      }
    }
  });

  it("returns the left page as the first page of a spread", () => {
    expect(firstPageOfSpread({ left: 3, right: 4 })).toBe(3);
    expect(firstPageOfSpread({ left: null, right: 0 })).toBe(0);
  });
});

describe("clamp helpers", () => {
  it("rejects non-numbers and non-finite values", () => {
    expect(clampNumber("12" as unknown, 0, 100, 7)).toBe(7);
    expect(clampNumber(Number.NaN, 0, 100, 7)).toBe(7);
    expect(clampNumber(1e9, 0, 100, 7)).toBe(100);
    expect(clampInt(2.6, 0, 10, 0)).toBe(3);
  });
});
