/**
 * Pure page-fold math. No DOM, no React.
 *
 * Coordinates are "spine coordinates": origin at the top of the spine, x grows
 * to the right, y grows down. A right-hand page occupies [0, W] x [0, H].
 */

export interface Point {
  x: number;
  y: number;
}

/** 2D affine transform, same layout as CSS `matrix(a, b, c, d, e, f)`. */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export type Corner = "top" | "bottom";

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Mirror across the vertical line x = 0. */
export const MIRROR_X: Affine = { a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function translate(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

/** Returns `m1 ∘ m2`: applies `m2` first, then `m1`. */
export function multiply(m1: Affine, m2: Affine): Affine {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

export function compose(...ms: Affine[]): Affine {
  return ms.reduce(multiply, IDENTITY);
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return IDENTITY;
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, e: -(a * m.e + c * m.f), f: -(b * m.e + d * m.f) };
}

export function apply(m: Affine, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** Applies only the linear part (for direction vectors). */
export function applyLinear(m: Affine, v: Point): Point {
  return { x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y };
}

export function mapPolygon(m: Affine, poly: Point[]): Point[] {
  return poly.map((p) => apply(m, p));
}

/** Reflection across the line through `origin` with unit direction `dir`. */
export function reflectAcross(origin: Point, dir: Point): Affine {
  const a = 2 * dir.x * dir.x - 1;
  const b = 2 * dir.x * dir.y;
  const d = 2 * dir.y * dir.y - 1;
  const linear: Affine = { a, b, c: b, d, e: 0, f: 0 };
  const moved = applyLinear(linear, origin);
  return { ...linear, e: origin.x - moved.x, f: origin.y - moved.y };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export function toCssMatrix(m: Affine): string {
  return `matrix(${round(m.a)}, ${round(m.b)}, ${round(m.c)}, ${round(m.d)}, ${round(m.e)}, ${round(m.f)})`;
}

export function toCssPolygon(poly: Point[]): string {
  if (poly.length < 3) return "polygon(0px 0px, 0px 0px, 0px 0px)";
  return `polygon(${poly.map((p) => `${round(p.x)}px ${round(p.y)}px`).join(", ")})`;
}

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * Sutherland–Hodgman clip of a convex polygon against one half-plane.
 * Keeps points where `sign * dot(p - origin, normal) >= 0`.
 */
export function clipHalfPlane(poly: Point[], origin: Point, normal: Point, sign: 1 | -1): Point[] {
  const side = (p: Point) => sign * dot(sub(p, origin), normal);
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const next = poly[(i + 1) % poly.length]!;
    const sc = side(cur);
    const sn = side(next);
    if (sc >= 0) out.push(cur);
    if ((sc >= 0) !== (sn >= 0)) {
      const t = sc / (sc - sn);
      out.push({ x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t });
    }
  }
  return out;
}

export function polygonArea(poly: Point[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
}

export function cornerPoint(corner: Corner, width: number, height: number): Point {
  return { x: width, y: corner === "bottom" ? height : 0 };
}

/** Where the dragged corner ends up once the page is fully turned. */
export function turnedCornerPoint(corner: Corner, width: number, height: number): Point {
  return { x: -width, y: corner === "bottom" ? height : 0 };
}

/**
 * Keeps the dragged corner where real paper could put it: the page cannot
 * stretch away from the spine or move past its own unfolded position.
 */
export function clampPoint(p: Point, corner: Corner, width: number, height: number): Point {
  const cornerY = corner === "bottom" ? height : 0;
  const oppositeY = height - cornerY;
  let x = Number.isFinite(p.x) ? Math.min(p.x, width) : width;
  let y = Number.isFinite(p.y) ? p.y : cornerY;

  // Distance to the spine point on the corner's edge cannot exceed the page width.
  const near = { x: 0, y: cornerY };
  let dx = x - near.x;
  let dy = y - near.y;
  let dist = Math.hypot(dx, dy);
  if (dist > width) {
    x = near.x + (dx / dist) * width;
    y = near.y + (dy / dist) * width;
  }

  // Distance to the opposite spine point cannot exceed the page diagonal.
  const far = { x: 0, y: oppositeY };
  const diagonal = Math.hypot(width, height);
  dx = x - far.x;
  dy = y - far.y;
  dist = Math.hypot(dx, dy);
  if (dist > diagonal) {
    x = far.x + (dx / dist) * diagonal;
    y = far.y + (dy / dist) * diagonal;
  }
  return { x, y };
}

export interface Fold {
  /** Midpoint between the corner and the dragged point; lies on the fold line. */
  origin: Point;
  /** Unit normal of the fold line, pointing toward the original corner. */
  normal: Point;
  /** Unit direction of the fold line. */
  direction: Point;
  /** 0 = flat, 1 = fully turned. */
  progress: number;
  /** Part of the page that is lifted (corner side), in page coordinates. */
  folded: Point[];
  /** Part of the page that stays flat, in page coordinates. */
  flat: Point[];
}

/**
 * Computes the fold for a right-hand page whose `corner` has been dragged to `point`.
 * Returns `null` when the page is not lifted at all.
 */
export function computeFold(point: Point, corner: Corner, width: number, height: number): Fold | null {
  const p = clampPoint(point, corner, width, height);
  const c = cornerPoint(corner, width, height);
  const v = sub(c, p);
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-6) return null;

  const normal = { x: v.x / len, y: v.y / len };
  const origin = { x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 };
  const page: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  return {
    origin,
    normal,
    direction: { x: -normal.y, y: normal.x },
    progress: Math.min(1, Math.max(0, (width - p.x) / (2 * width))),
    folded: clipHalfPlane(page, origin, normal, 1),
    flat: clipHalfPlane(page, origin, normal, -1),
  };
}
