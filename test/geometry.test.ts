import { describe, expect, it } from "vitest";
import {
  apply,
  clampPoint,
  compose,
  computeFold,
  invert,
  polygonArea,
  reflectAcross,
  toCssPolygon,
  translate,
} from "../src/geometry";

const W = 400;
const H = 600;

describe("affine helpers", () => {
  it("invert undoes a transform", () => {
    const m = compose(translate(10, -5), reflectAcross({ x: 3, y: 4 }, { x: 0.6, y: 0.8 }));
    const p = { x: 123, y: -45 };
    const back = apply(invert(m), apply(m, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it("reflection keeps points on the line fixed", () => {
    const r = reflectAcross({ x: 10, y: 10 }, { x: 0, y: 1 });
    expect(apply(r, { x: 10, y: 50 })).toEqual({ x: 10, y: 50 });
    const q = apply(r, { x: 20, y: 0 });
    expect(q.x).toBeCloseTo(0);
  });
});

describe("clampPoint", () => {
  it("never lets the corner leave the reach of the spine", () => {
    for (const p of [
      { x: -5000, y: 5000 },
      { x: -5000, y: -5000 },
      { x: 5000, y: 300 },
      { x: Number.NaN, y: Number.POSITIVE_INFINITY },
    ]) {
      const c = clampPoint(p, "bottom", W, H);
      expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
      expect(Math.hypot(c.x, c.y - H)).toBeLessThanOrEqual(W + 1e-6);
      expect(Math.hypot(c.x, c.y)).toBeLessThanOrEqual(Math.hypot(W, H) + 1e-6);
      expect(c.x).toBeLessThanOrEqual(W);
    }
  });
});

describe("computeFold", () => {
  it("returns null when the corner has not moved", () => {
    expect(computeFold({ x: W, y: H }, "bottom", W, H)).toBeNull();
  });

  it("splits the page into two parts that add up to the whole page", () => {
    const fold = computeFold({ x: 100, y: 450 }, "bottom", W, H)!;
    expect(polygonArea(fold.folded) + polygonArea(fold.flat)).toBeCloseTo(W * H, 3);
    expect(fold.progress).toBeGreaterThan(0);
    expect(fold.progress).toBeLessThan(1);
  });

  it("folds the whole page when fully turned", () => {
    const fold = computeFold({ x: -W, y: H }, "bottom", W, H)!;
    expect(polygonArea(fold.folded)).toBeCloseTo(W * H, 3);
    expect(polygonArea(fold.flat)).toBeCloseTo(0, 3);
    expect(fold.progress).toBe(1);
  });

  it("works for the top corner", () => {
    const fold = computeFold({ x: 200, y: 80 }, "top", W, H)!;
    expect(polygonArea(fold.folded) + polygonArea(fold.flat)).toBeCloseTo(W * H, 3);
  });
});

describe("toCssPolygon", () => {
  it("hides degenerate polygons", () => {
    expect(toCssPolygon([])).toBe("polygon(0px 0px, 0px 0px, 0px 0px)");
  });
});
