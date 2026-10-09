export type ViewMode = "single" | "double";

/** Pages visible side by side. `null` means the slot is empty. */
export interface Spread {
  left: number | null;
  right: number | null;
}

/** Turns any input into a finite number within [min, max], or `fallback`. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function coverOffset(mode: ViewMode, showCover: boolean): number {
  return mode === "double" && showCover ? 1 : 0;
}

export function buildSpreads(pageCount: number, mode: ViewMode, showCover: boolean): Spread[] {
  const count = Math.max(0, Math.floor(pageCount));
  if (count === 0) return [];
  if (mode === "single") {
    return Array.from({ length: count }, (_, i) => ({ left: null, right: i }));
  }
  const offset = coverOffset(mode, showCover);
  const spreads = Math.ceil((count + offset) / 2);
  const page = (i: number) => (i >= 0 && i < count ? i : null);
  return Array.from({ length: spreads }, (_, k) => ({
    left: page(2 * k - offset),
    right: page(2 * k + 1 - offset),
  }));
}

export function spreadIndexOfPage(page: number, mode: ViewMode, showCover: boolean): number {
  if (mode === "single") return page;
  return Math.floor((page + coverOffset(mode, showCover)) / 2);
}

/** First page shown by a spread (left page if present). */
export function firstPageOfSpread(spread: Spread | undefined): number {
  return spread?.left ?? spread?.right ?? 0;
}
