import { describe, expect, it } from "vitest";
import { apply } from "../src/geometry";
import { buildSpreads } from "../src/layout";
import { computeScene } from "../src/scene";

const W = 300;
const H = 400;
const spreads = buildSpreads(6, "double", true);
const base = { width: W, height: H, mode: "double" as const, spreads, shadows: true };

describe("computeScene", () => {
  it("shows both pages of the current spread when idle", () => {
    const layers = computeScene({ ...base, current: 1, flip: null });
    expect(layers.map((l) => l.key)).toEqual([1, 2]);
    expect(apply(layers[0]!.matrix, { x: 0, y: 0 })).toEqual({ x: -W, y: 0 });
  });

  it("assigns front, back and under pages for a forward flip", () => {
    const layers = computeScene({
      ...base,
      current: 1,
      flip: { from: 1, to: 2, corner: "bottom", point: { x: 0, y: H - 50 } },
    });
    const keys = Object.fromEntries(layers.map((l) => [l.key, l.zIndex]));
    expect(keys).toEqual({ 1: 1, 4: 1, 2: 2, 3: 3 });
  });

  it("lands the back page exactly on its final slot when the flip ends", () => {
    for (const [from, to, backPage, x0] of [
      [1, 2, 3, -W],
      [2, 1, 2, 0],
    ] as const) {
      const layers = computeScene({
        ...base,
        current: from,
        flip: { from, to, corner: "bottom", point: { x: -W, y: H } },
      });
      const back = layers.find((l) => l.key === backPage)!;
      const topLeft = apply(back.matrix, { x: 0, y: 0 });
      const bottomRight = apply(back.matrix, { x: W, y: H });
      expect(topLeft.x).toBeCloseTo(x0);
      expect(topLeft.y).toBeCloseTo(0);
      expect(bottomRight.x).toBeCloseTo(x0 + W);
      expect(bottomRight.y).toBeCloseTo(H);
    }
  });

  it("uses a blank back in single mode", () => {
    const layers = computeScene({
      ...base,
      mode: "single",
      spreads: buildSpreads(3, "single", true),
      current: 0,
      flip: { from: 0, to: 1, corner: "top", point: { x: 100, y: 40 } },
    });
    expect(layers.map((l) => l.key).sort()).toEqual([0, 1, "blank"].sort());
  });
});
