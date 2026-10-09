export type Easing = (t: number) => number;

export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);

export interface TweenOptions {
  duration: number;
  easing: Easing;
  onUpdate: (t: number) => void;
  onComplete: () => void;
}

const raf: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

const caf: (id: number) => void =
  typeof cancelAnimationFrame === "function" ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

/** Runs `onUpdate(eased t)` every frame from 0 to 1. Returns a cancel function. */
export function tween({ duration, easing, onUpdate, onComplete }: TweenOptions): () => void {
  if (!(duration > 0)) {
    onUpdate(1);
    onComplete();
    return () => {};
  }
  let start: number | null = null;
  let cancelled = false;
  let id = 0;
  const step = (now: number) => {
    if (cancelled) return;
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / duration);
    onUpdate(easing(t));
    if (t < 1) id = raf(step);
    else onComplete();
  };
  id = raf(step);
  return () => {
    cancelled = true;
    caf(id);
  };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
