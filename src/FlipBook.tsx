import {
  Children,
  forwardRef,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { easeInOutCubic, easeOutCubic, prefersReducedMotion, tween } from "./animation";
import {
  type Corner,
  type Point,
  clampPoint,
  cornerPoint,
  toCssMatrix,
  toCssPolygon,
  turnedCornerPoint,
} from "./geometry";
import {
  type Spread,
  type ViewMode,
  buildSpreads,
  clampInt,
  clampNumber,
  firstPageOfSpread,
  spreadIndexOfPage,
} from "./layout";
import { type FlipGeometry, type PageLayer, type Shadow, computeScene, isReversed } from "./scene";
import type { FlipBookHandle, FlipBookProps, FlipBookState, FlipEvent } from "./types";

/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 6;
/** In `auto` mode, two pages are shown when the container is at least this many page widths wide. */
const AUTO_DOUBLE_RATIO = 1.5;
/** Size of the hover zone at each outer corner, as a fraction of the shorter page side. */
const PEEK_ZONE = 0.2;
/** How far a hovered corner lifts, as a fraction of the shorter page side. */
const PEEK_AMOUNT = 0.13;
const PEEK_DURATION = 220;
/** Presses on these elements never start a flip, so links and form controls inside pages keep working. */
const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[data-flipzy-no-flip]",
].join(",");

interface ActiveFlip extends FlipGeometry {
  /** `peek` = corner lifted on hover; it never changes the page and is not reported as a state. */
  phase: "peek" | "dragging" | "flipping";
  /** Corner position that completes the flip. */
  complete: Point;
  /** Corner position that cancels it. */
  cancel: Point;
}

interface PointerTrack {
  id: number;
  clientX: number;
  clientY: number;
  /** Press position in spine coordinates. */
  start: Point;
  forward: boolean;
  dragging: boolean;
  /** Corner position (normalized) when the drag started. */
  origin: Point;
}

interface Live {
  W: number;
  H: number;
  viewMode: ViewMode;
  showCover: boolean;
  spreads: Spread[];
  current: number;
  currentPage: number;
  pageCount: number;
  duration: number;
  drag: boolean;
  clickToFlip: boolean;
  hoverPeek: boolean;
  naturalWidth: number;
  spineX: number;
  onFlip: ((event: FlipEvent) => void) | undefined;
  onStateChange: ((state: FlipBookState) => void) | undefined;
}

const defaultAnnouncement = (page: number, pageCount: number) => `Page ${page + 1} of ${pageCount}`;

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

function createFlip(from: number, to: number, corner: Corner, L: Live): ActiveFlip {
  const flat = cornerPoint(corner, L.W, L.H);
  const turned = turnedCornerPoint(corner, L.W, L.H);
  const reversed = isReversed(L.viewMode, from, to);
  return {
    from,
    to,
    corner,
    phase: "dragging",
    point: reversed ? turned : flat,
    complete: reversed ? flat : turned,
    cancel: reversed ? turned : flat,
  };
}

/** Maps a pointer position to the normalized corner position of the page being dragged. */
function dragPoint(f: ActiveFlip, t: PointerTrack, p: Point, L: Live): Point {
  const dx = p.x - t.start.x;
  const dy = p.y - t.start.y;
  if (L.viewMode === "double") {
    // Backward flips are mirrored in the normalized frame.
    return { x: t.origin.x + (f.to > f.from ? dx : -dx), y: t.origin.y + dy };
  }
  // A single page is only W wide, so the pointer travel is doubled to cover a full turn.
  return { x: t.origin.x + 2 * dx, y: t.origin.y + dy };
}

/** The corner under the mouse that can be lifted, if any. */
function peekTarget(p: Point, L: Live): { to: number; corner: Corner } | null {
  const zone = Math.min(L.W, L.H) * PEEK_ZONE;
  const corner: Corner | null = p.y >= 0 && p.y < zone ? "top" : p.y <= L.H && p.y > L.H - zone ? "bottom" : null;
  if (!corner) return null;
  const leftEdge = L.viewMode === "double" ? -L.W : 0;
  let to: number;
  if (p.x <= L.W && p.x > L.W - zone) to = L.current + 1;
  else if (p.x >= leftEdge && p.x < leftEdge + zone) to = L.current - 1;
  else return null;
  return to >= 0 && to < L.spreads.length ? { to, corner } : null;
}

function peekPoint(f: ActiveFlip, L: Live): Point {
  const amount = Math.min(L.W, L.H) * PEEK_AMOUNT;
  const sign = f.complete.x > f.cancel.x ? 1 : -1;
  return { x: f.cancel.x + sign * amount, y: f.cancel.y + (f.corner === "bottom" ? -amount : amount) };
}

function toSpine(el: HTMLElement, L: Live, clientX: number, clientY: number): Point {
  const rect = el.getBoundingClientRect();
  const scale = rect.width > 0 ? rect.width / L.naturalWidth : 1;
  return { x: (clientX - rect.left) / scale - L.spineX, y: (clientY - rect.top) / scale };
}

function isInteractiveTarget(target: EventTarget | null, boundary: Element): boolean {
  if (!(target instanceof Element)) return false;
  const hit = target.closest(INTERACTIVE_SELECTOR);
  return hit !== null && hit !== boundary && boundary.contains(hit);
}

function keyOf(child: ReactNode, index: number): string | number {
  return isValidElement(child) && child.key != null ? child.key : index;
}

/** Which halves of a double spread hold a page; drives the optional stylesheet. */
function spreadShape(viewMode: ViewMode, shown: (Spread | undefined)[]): "single" | "full" | "cover" | "back" {
  if (viewMode === "single") return "single";
  const left = shown.some((s) => s?.left != null);
  const right = shown.some((s) => s?.right != null);
  return left && right ? "full" : left ? "back" : "cover";
}

export const FlipBook = forwardRef<FlipBookHandle, FlipBookProps>(function FlipBook(props, ref) {
  const {
    children,
    width,
    height,
    startPage = 0,
    mode = "auto",
    showCover = true,
    flipDuration = 700,
    drag = true,
    clickToFlip = true,
    keyboard = true,
    shadows = true,
    hoverPeek = true,
    onFlip,
    onStateChange,
    getPageAnnouncement = defaultAnnouncement,
    "aria-label": ariaLabel = "Flipbook",
    className,
    style,
  } = props;

  // Props are validated at runtime too: a NaN or huge size must not break the page.
  const W = clampNumber(width, 1, 10000, 400);
  const H = clampNumber(height, 1, 10000, 560);
  const duration = clampNumber(flipDuration, 0, 10000, 700);

  const pages = useMemo(() => Children.toArray(children), [children]);
  const pageCount = pages.length;

  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [page, setPage] = useState(() => clampInt(startPage, 0, Number.MAX_SAFE_INTEGER, 0));
  const [flip, setFlipState] = useState<ActiveFlip | null>(null);

  const viewMode: ViewMode =
    mode === "single" || mode === "double"
      ? mode
      : containerWidth !== null && containerWidth < W * AUTO_DOUBLE_RATIO
        ? "single"
        : "double";
  const spreads = useMemo(() => buildSpreads(pageCount, viewMode, showCover), [pageCount, viewMode, showCover]);
  const currentPage = pageCount === 0 ? 0 : Math.min(page, pageCount - 1);
  const current = spreadIndexOfPage(currentPage, viewMode, showCover);
  const naturalWidth = viewMode === "double" ? 2 * W : W;
  const spineX = viewMode === "double" ? W : 0;
  const scale = containerWidth === null || containerWidth <= 0 ? 1 : Math.min(1, containerWidth / naturalWidth);

  // Event handlers are stable and read the latest render's values from here.
  const live = useRef<Live>(null as unknown as Live);
  live.current = {
    W,
    H,
    viewMode,
    showCover,
    spreads,
    current,
    currentPage,
    pageCount,
    duration,
    drag,
    clickToFlip,
    hoverPeek,
    naturalWidth,
    spineX,
    onFlip,
    onStateChange,
  };

  const flipRef = useRef<ActiveFlip | null>(null);
  const cancelTween = useRef<(() => void) | null>(null);
  const pointer = useRef<PointerTrack | null>(null);
  const stateRef = useRef<FlipBookState>("idle");
  /** True while a hover peek is settling back down. */
  const peekLeaving = useRef(false);

  const setFlip = useCallback((f: ActiveFlip | null) => {
    flipRef.current = f;
    setFlipState(f);
  }, []);

  const emitState = useCallback((s: FlipBookState) => {
    if (stateRef.current === s) return;
    stateRef.current = s;
    live.current.onStateChange?.(s);
  }, []);

  const stopTween = useCallback(() => {
    cancelTween.current?.();
    cancelTween.current = null;
    peekLeaving.current = false;
  }, []);

  const stopAnimation = useCallback(() => {
    stopTween();
    pointer.current = null;
    if (flipRef.current) setFlip(null);
    emitState("idle");
  }, [stopTween, setFlip, emitState]);

  const commitSpread = useCallback((spreadIndex: number) => {
    const L = live.current;
    const next = firstPageOfSpread(L.spreads[spreadIndex]);
    // Keep the live values current until the next render, so rapid API calls chain correctly.
    L.current = spreadIndex;
    L.currentPage = next;
    setPage(next);
    L.onFlip?.({ page: next, pageCount: L.pageCount });
  }, []);

  const runTo = useCallback(
    (f: ActiveFlip, completes: boolean, ms: number, lift: boolean) => {
      const { W: w, H: h } = live.current;
      const start = clampPoint(f.point, f.corner, w, h);
      const target = completes ? f.complete : f.cancel;
      const base: ActiveFlip = { ...f, phase: "flipping", point: start };
      const liftDir = f.corner === "bottom" ? -1 : 1;
      stopTween();
      setFlip(base);
      emitState("flipping");
      cancelTween.current = tween({
        duration: ms,
        easing: lift ? easeInOutCubic : easeOutCubic,
        onUpdate: (t) => {
          const lifted = lift ? liftDir * Math.sin(Math.PI * t) * h * 0.12 : 0;
          setFlip({
            ...base,
            point: { x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t + lifted },
          });
        },
        onComplete: () => {
          cancelTween.current = null;
          setFlip(null);
          if (completes) commitSpread(f.to);
          emitState("idle");
        },
      });
    },
    [stopTween, setFlip, emitState, commitSpread],
  );

  /** Moves a peeking corner to `target`; `settle` removes the peek once it is flat again. */
  const animatePeek = useCallback(
    (f: ActiveFlip, target: Point, settle: boolean) => {
      stopTween();
      peekLeaving.current = settle;
      const start = f.point;
      setFlip(f);
      cancelTween.current = tween({
        duration: PEEK_DURATION,
        easing: easeOutCubic,
        onUpdate: (t) =>
          setFlip({ ...f, point: { x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t } }),
        onComplete: () => {
          cancelTween.current = null;
          peekLeaving.current = false;
          if (settle) setFlip(null);
        },
      });
    },
    [stopTween, setFlip],
  );

  const endPeek = useCallback(() => {
    const f = flipRef.current;
    if (f?.phase === "peek" && !peekLeaving.current) animatePeek(f, f.cancel, true);
  }, [animatePeek]);

  const goToSpread = useCallback(
    (to: number, animate: boolean) => {
      const L = live.current;
      if (!Number.isInteger(to) || to < 0 || to >= L.spreads.length) return;
      const active = flipRef.current;
      const smooth = animate && L.duration > 0 && !prefersReducedMotion();
      if (active?.phase === "peek") {
        // Continue from the lifted corner instead of starting over.
        if (smooth && to === active.to) {
          runTo(active, true, L.duration, true);
          return;
        }
        stopTween();
        setFlip(null);
      } else if (active) {
        if (animate) return;
        stopAnimation();
      }
      if (to === L.current) return;
      if (!smooth) {
        commitSpread(to);
        return;
      }
      runTo(createFlip(L.current, to, "bottom", L), true, L.duration, true);
    },
    [stopTween, setFlip, stopAnimation, commitSpread, runTo],
  );

  useImperativeHandle(
    ref,
    () => ({
      flipNext: () => goToSpread(live.current.current + 1, true),
      flipPrev: () => goToSpread(live.current.current - 1, true),
      flipTo: (target, options) => {
        const L = live.current;
        if (L.pageCount === 0) return;
        const p = clampInt(target, 0, L.pageCount - 1, L.currentPage);
        goToSpread(spreadIndexOfPage(p, L.viewMode, L.showCover), options?.animate !== false);
      },
      getCurrentPage: () => live.current.currentPage,
      getPageCount: () => live.current.pageCount,
    }),
    [goToSpread],
  );

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const active = flipRef.current;
    if (!e.isPrimary || e.button !== 0 || (active && active.phase !== "peek")) return;
    if (isInteractiveTarget(e.target, e.currentTarget)) return;
    const L = live.current;
    const p = toSpine(e.currentTarget, L, e.clientX, e.clientY);
    pointer.current = {
      id: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      start: p,
      forward: L.viewMode === "double" ? p.x >= 0 : p.x >= L.W / 2,
      dragging: false,
      origin: p,
    };
  }, []);

  const updatePeek = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const L = live.current;
      const active = flipRef.current;
      if (e.pointerType !== "mouse" || !L.hoverPeek || (!L.drag && !L.clickToFlip)) return;
      if ((active && active.phase !== "peek") || prefersReducedMotion()) return;
      if (isInteractiveTarget(e.target, e.currentTarget)) {
        endPeek();
        return;
      }
      const target = peekTarget(toSpine(e.currentTarget, L, e.clientX, e.clientY), L);
      if (!target) {
        endPeek();
        return;
      }
      const same = active && active.to === target.to && active.corner === target.corner;
      if (same && !peekLeaving.current) return;
      const f: ActiveFlip = same ? active : { ...createFlip(L.current, target.to, target.corner, L), phase: "peek" };
      animatePeek(f, peekPoint(f, L), false);
    },
    [endPeek, animatePeek],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const t = pointer.current;
      if (!t) {
        updatePeek(e);
        return;
      }
      if (t.id !== e.pointerId) return;
      const L = live.current;
      if (!t.dragging) {
        if (!L.drag || Math.hypot(e.clientX - t.clientX, e.clientY - t.clientY) < DRAG_THRESHOLD) return;
        const to = L.current + (t.forward ? 1 : -1);
        const active = flipRef.current;
        if ((active && active.phase !== "peek") || to < 0 || to >= L.spreads.length) {
          pointer.current = null;
          return;
        }
        t.dragging = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Pointer capture is optional; dragging still works without it.
        }
        stopTween();
        const corner: Corner = t.start.y < L.H / 2 ? "top" : "bottom";
        // A lifted corner on the same page turns straight into the drag.
        const f: ActiveFlip =
          active && active.to === to && active.corner === corner
            ? { ...active, phase: "dragging" }
            : createFlip(L.current, to, corner, L);
        t.origin = f.point;
        setFlip(f);
        emitState("dragging");
      }
      const f = flipRef.current;
      if (!f || f.phase !== "dragging") return;
      const p = toSpine(e.currentTarget, L, e.clientX, e.clientY);
      setFlip({ ...f, point: dragPoint(f, t, p, L) });
    },
    [updatePeek, stopTween, setFlip, emitState],
  );

  const handlePointerEnd = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const t = pointer.current;
      if (!t || t.id !== e.pointerId) return;
      pointer.current = null;
      const L = live.current;
      if (t.dragging) {
        const f = flipRef.current;
        if (!f || f.phase !== "dragging") return;
        const p = clampPoint(f.point, f.corner, L.W, L.H);
        const completes = e.type === "pointerup" && Math.abs(p.x - f.complete.x) < Math.abs(p.x - f.cancel.x);
        const target = completes ? f.complete : f.cancel;
        const ms = prefersReducedMotion() ? 0 : Math.max(120, (L.duration * Math.abs(p.x - target.x)) / (2 * L.W));
        runTo(f, completes, L.duration === 0 ? 0 : ms, false);
        return;
      }
      if (e.type === "pointerup" && L.clickToFlip) goToSpread(L.current + (t.forward ? 1 : -1), true);
    },
    [runTo, goToSpread],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!keyboard || isInteractiveTarget(e.target, e.currentTarget)) return;
      const L = live.current;
      let to: number;
      if (e.key === "ArrowRight" || e.key === "PageDown") to = L.current + 1;
      else if (e.key === "ArrowLeft" || e.key === "PageUp") to = L.current - 1;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = L.spreads.length - 1;
      else return;
      e.preventDefault();
      goToSpread(to, true);
    },
    [keyboard, goToSpread],
  );

  // Watch the container (not the book itself) so switching modes cannot feed back into the measurement.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth || null);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined && w > 0) setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A running flip refers to spread indices that change with the layout, so drop it.
  useEffect(() => {
    if (flipRef.current) stopAnimation();
  }, [viewMode, pageCount, showCover, stopAnimation]);

  // Never leave an animation frame running after unmount.
  useEffect(
    () => () => {
      cancelTween.current?.();
      cancelTween.current = null;
    },
    [],
  );

  const layers = useMemo(
    () => computeScene({ width: W, height: H, mode: viewMode, spreads, current, flip, shadows }),
    [W, H, viewMode, spreads, current, flip, shadows],
  );
  const byKey = new Map<PageLayer["key"], PageLayer>(layers.map((l) => [l.key, l]));
  const blank = byKey.get("blank");
  const shape = spreadShape(viewMode, flip ? [spreads[flip.from], spreads[flip.to]] : [spreads[current]]);
  const progress = spreads.length > 1 ? current / (spreads.length - 1) : 0;

  return (
    <div
      ref={rootRef}
      className={className ? `flipzy ${className}` : "flipzy"}
      style={{ position: "relative", width: "100%", overflowX: "clip", ...style }}
      role="region"
      aria-roledescription="flipbook"
      aria-label={ariaLabel}
      tabIndex={keyboard ? 0 : undefined}
      onKeyDown={handleKeyDown}
      data-flipzy=""
    >
      <div
        className="flipzy__book"
        data-flipzy-book=""
        data-mode={viewMode}
        data-state={flip ? flip.phase : "idle"}
        data-spread={shape}
        style={
          {
            "--flipzy-progress": Math.round(progress * 1000) / 1000,
            position: "relative",
            width: "100%",
            maxWidth: naturalWidth,
            aspectRatio: `${naturalWidth} / ${H}`,
            margin: "0 auto",
            touchAction: "pan-y",
            userSelect: flip && flip.phase !== "peek" ? "none" : undefined,
            WebkitUserSelect: flip && flip.phase !== "peek" ? "none" : undefined,
          } as CSSProperties
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={endPeek}
        onDragStart={(e) => e.preventDefault()}
      >
        <div
          className="flipzy__stage"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: naturalWidth,
            height: H,
            transformOrigin: "0 0",
            transform: `scale(${scale})`,
          }}
        >
          {pages.map((child, i) => (
            <PageView key={keyOf(child, i)} index={i} layer={byKey.get(i)} width={W} height={H} left={spineX}>
              {child}
            </PageView>
          ))}
          {blank && <PageView index={-1} layer={blank} width={W} height={H} left={spineX} />}
        </div>
      </div>
      <div className="flipzy__sr" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
        {pageCount > 0 ? getPageAnnouncement(currentPage, pageCount) : ""}
      </div>
    </div>
  );
});

interface PageViewProps {
  index: number;
  layer: PageLayer | undefined;
  width: number;
  height: number;
  left: number;
  children?: ReactNode;
}

const PageView = memo(function PageView({ index, layer, width, height, left, children }: PageViewProps) {
  const style: CSSProperties = {
    position: "absolute",
    left,
    top: 0,
    width,
    height,
    overflow: "hidden",
    boxSizing: "border-box",
    background: "var(--flipzy-page-bg, #fff)",
    transformOrigin: "0 0",
    display: layer ? "block" : "none",
  };
  let className = "flipzy__page";
  if (layer) {
    style.transform = toCssMatrix(layer.matrix);
    style.zIndex = layer.zIndex;
    if (layer.clip) {
      style.clipPath = toCssPolygon(layer.clip);
      style.WebkitClipPath = style.clipPath;
    }
    className += ` flipzy__page--${layer.slot} flipzy__page--${layer.role}`;
  }
  if (index < 0) className += " flipzy__page--blank";
  return (
    <div className={className} data-flipzy-page={index >= 0 ? index : "blank"} style={style}>
      {children}
      {layer?.gutter && <div className="flipzy__gutter" aria-hidden="true" style={gutterStyle(layer.gutter)} />}
      {layer?.shadow && (
        <div className="flipzy__shadow" aria-hidden="true" style={shadowStyle(layer.shadow, width, height)} />
      )}
    </div>
  );
});

function gutterStyle(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    bottom: 0,
    [side]: 0,
    width: "8%",
    pointerEvents: "none",
    background: `linear-gradient(to ${side === "left" ? "right" : "left"}, rgba(0,0,0,calc(0.16 * var(--flipzy-gutter-strength, 1))), rgba(0,0,0,0))`,
  };
}

function shadowStyle(s: Shadow, width: number, height: number): CSSProperties {
  const length = 3 * Math.hypot(width, height);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: r(s.width),
    height: r(length),
    pointerEvents: "none",
    transformOrigin: "0 0",
    transform: `translate(${r(s.x)}px, ${r(s.y)}px) rotate(${r(s.angle)}rad) translate(0px, ${r(-length / 2)}px)`,
    background: `linear-gradient(to right, rgba(0,0,0,calc(${r(s.opacity)} * var(--flipzy-shadow-strength, 1))), rgba(0,0,0,0))`,
  };
}
