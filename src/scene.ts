import {
  type Affine,
  type Corner,
  type Point,
  IDENTITY,
  MIRROR_X,
  applyLinear,
  apply,
  compose,
  computeFold,
  invert,
  mapPolygon,
  reflectAcross,
  translate,
} from "./geometry";
import type { Spread, ViewMode } from "./layout";

/** A page being turned from spread `from` to spread `to`. */
export interface FlipGeometry {
  from: number;
  to: number;
  corner: Corner;
  /**
   * Dragged corner position in the *normalized* frame, where the turning page
   * is always a right-hand page moving to the left.
   */
  point: Point;
}

/** Gradient shadow drawn inside a page, starting at a line and fading along `angle`. */
export interface Shadow {
  x: number;
  y: number;
  angle: number;
  width: number;
  opacity: number;
}

/** How one page (or the blank back of a single page) is drawn. */
export type PageRole = "static" | "front" | "back" | "under";

export interface PageLayer {
  key: number | "blank";
  role: PageRole;
  /** Slot the page rests in when the book is idle (for the back page: where it lands). */
  slot: "left" | "right";
  /** Maps page-local coordinates to spine coordinates. */
  matrix: Affine;
  /** Visible region in page-local coordinates; `null` = whole page. */
  clip: Point[] | null;
  zIndex: number;
  shadow: Shadow | null;
  /** Page edge that touches the spine, for the gutter shadow. */
  gutter: "left" | "right" | null;
}

export interface SceneInput {
  width: number;
  height: number;
  mode: ViewMode;
  spreads: Spread[];
  current: number;
  flip: FlipGeometry | null;
  shadows: boolean;
}

type Slot = "left" | "right";

/**
 * Single-mode backward flips run the forward animation in reverse: the previous
 * page comes back from the left and settles on top of the current one.
 */
export function isReversed(mode: ViewMode, from: number, to: number): boolean {
  return mode === "single" && to < from;
}

export function computeScene(input: SceneInput): PageLayer[] {
  const { width: W, height: H, mode, spreads, current, flip, shadows } = input;
  const double = mode === "double";
  const slotMatrix = (slot: Slot): Affine => (slot === "left" ? translate(-W, 0) : IDENTITY);
  const gutterOf = (slot: Slot): PageLayer["gutter"] =>
    !double || !shadows ? null : slot === "left" ? "right" : "left";
  const flat = (key: number, slot: Slot, role: PageRole = "static", zIndex = 1): PageLayer => ({
    key,
    role,
    slot,
    matrix: slotMatrix(slot),
    clip: null,
    zIndex,
    shadow: null,
    gutter: gutterOf(slot),
  });

  const layers: PageLayer[] = [];

  if (!flip) {
    const spread = spreads[current];
    if (!spread) return layers;
    if (double && spread.left !== null) layers.push(flat(spread.left, "left"));
    if (spread.right !== null) layers.push(flat(spread.right, "right"));
    return layers;
  }

  const fromSpread = spreads[flip.from];
  const toSpread = spreads[flip.to];
  if (!fromSpread || !toSpread) return computeScene({ ...input, flip: null });

  const forward = flip.to > flip.from;
  // Normalized frame -> spine coordinates.
  const N = double && !forward ? MIRROR_X : IDENTITY;

  let staticPage: number | null = null;
  let front: number | null;
  let under: number | null;
  let back: number | "blank" | null;
  let frontSlot: Slot;
  let backSlot: Slot;
  let staticSlot: Slot;

  if (double) {
    if (forward) {
      staticPage = fromSpread.left;
      staticSlot = "left";
      front = fromSpread.right;
      under = toSpread.right;
      back = toSpread.left;
      frontSlot = "right";
      backSlot = "left";
    } else {
      staticPage = fromSpread.right;
      staticSlot = "right";
      front = fromSpread.left;
      under = toSpread.left;
      back = toSpread.right;
      frontSlot = "left";
      backSlot = "right";
    }
  } else {
    staticSlot = "left";
    front = forward ? fromSpread.right : toSpread.right;
    under = forward ? toSpread.right : fromSpread.right;
    back = "blank";
    frontSlot = "right";
    backSlot = "left";
  }

  const fold = computeFold(flip.point, flip.corner, W, H);
  // A barely lifted corner still casts a visible shadow; it fades out as the page lands.
  const strength = fold ? Math.sin(Math.max(fold.progress, 0.15) * Math.PI) : 0;

  if (staticPage !== null) layers.push(flat(staticPage, staticSlot));

  if (under !== null) {
    const layer = flat(under, frontSlot, "under");
    if (fold && shadows) {
      const toLocal = compose(invert(slotMatrix(frontSlot)), N);
      layer.shadow = shadowAt(toLocal, fold.origin, fold.normal, W * 0.3, 0.45 * strength);
    }
    layers.push(layer);
  }

  if (front !== null) {
    const layer = flat(front, frontSlot, "front", 2);
    if (fold) {
      layer.clip = mapPolygon(compose(invert(slotMatrix(frontSlot)), N), fold.flat);
    }
    layers.push(layer);
  }

  if (fold && back !== null) {
    const reflect = reflectAcross(fold.origin, fold.direction);
    // Page-local -> final (flat) position -> normalized -> folded -> spine coordinates.
    const matrix = compose(N, reflect, MIRROR_X, N, slotMatrix(backSlot));
    const toLocal = invert(matrix);
    layers.push({
      key: back,
      role: "back",
      slot: backSlot,
      matrix,
      clip: mapPolygon(compose(toLocal, N, reflect), fold.folded),
      zIndex: 3,
      shadow: shadows
        ? shadowAt(compose(toLocal, N), fold.origin, { x: -fold.normal.x, y: -fold.normal.y }, W * 0.2, 0.3 * strength)
        : null,
      gutter: back === "blank" ? null : gutterOf(backSlot),
    });
  }

  return layers;
}

function shadowAt(toLocal: Affine, origin: Point, normal: Point, width: number, opacity: number): Shadow {
  const p = apply(toLocal, origin);
  const dir = applyLinear(toLocal, normal);
  return { x: p.x, y: p.y, angle: Math.atan2(dir.y, dir.x), width, opacity };
}
