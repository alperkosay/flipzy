import type { CSSProperties, ReactNode } from "react";

/** How pages are laid out. `auto` switches to `single` when the container is narrow. */
export type FlipBookMode = "auto" | "single" | "double";

/** Animation state of the book. */
export type FlipBookState = "idle" | "dragging" | "flipping";

export interface FlipEvent {
  /** Index of the first visible page after the flip. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
}

export interface FlipToOptions {
  /** Animate the flip. Defaults to `true`. */
  animate?: boolean;
}

/** Methods exposed through `ref`. */
export interface FlipBookHandle {
  flipNext(): void;
  flipPrev(): void;
  flipTo(page: number, options?: FlipToOptions): void;
  getCurrentPage(): number;
  getPageCount(): number;
}

export interface FlipBookProps {
  /** Every child is one page. */
  children?: ReactNode;
  /** Width of a single page in px. */
  width: number;
  /** Height of a single page in px. */
  height: number;
  /** Page shown on first render. Defaults to `0`. */
  startPage?: number;
  /** Layout mode. Defaults to `"auto"`. */
  mode?: FlipBookMode;
  /** First (and last) page stands alone as a cover in double mode. Defaults to `true`. */
  showCover?: boolean;
  /** Duration of a full automatic flip in ms. Defaults to `700`. */
  flipDuration?: number;
  /** Allow flipping by dragging a page. Defaults to `true`. */
  drag?: boolean;
  /** Flip when a page is clicked. Defaults to `true`. */
  clickToFlip?: boolean;
  /** Arrow keys, Home and End flip pages when the book has focus. Defaults to `true`. */
  keyboard?: boolean;
  /** Draw fold and gutter shadows. Defaults to `true`. */
  shadows?: boolean;
  /** Lift the page corner slightly when the mouse hovers over it. Defaults to `true`. */
  hoverPeek?: boolean;
  /** Called after the visible page changes. */
  onFlip?: (event: FlipEvent) => void;
  /** Called when the animation state changes. */
  onStateChange?: (state: FlipBookState) => void;
  /** Text announced to screen readers after a flip. */
  getPageAnnouncement?: (page: number, pageCount: number) => string;
  /** Accessible name of the book. Defaults to `"Flipbook"`. */
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
}
