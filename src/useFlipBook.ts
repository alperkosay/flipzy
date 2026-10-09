import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlipBookHandle, FlipBookState, FlipEvent, FlipToOptions } from "./types";

/**
 * Convenience hook for controlling a `FlipBook` and reading its state.
 *
 * ```tsx
 * const book = useFlipBook();
 * <FlipBook width={400} height={560} {...book.bind}>…</FlipBook>
 * <button onClick={book.flipNext}>Next</button>
 * ```
 */
export function useFlipBook() {
  const ref = useRef<FlipBookHandle>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [state, setState] = useState<FlipBookState>("idle");

  useEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    setPage(handle.getCurrentPage());
    setPageCount(handle.getPageCount());
  }, []);

  const onFlip = useCallback((event: FlipEvent) => {
    setPage(event.page);
    setPageCount(event.pageCount);
  }, []);

  const flipNext = useCallback(() => ref.current?.flipNext(), []);
  const flipPrev = useCallback(() => ref.current?.flipPrev(), []);
  const flipTo = useCallback((target: number, options?: FlipToOptions) => ref.current?.flipTo(target, options), []);

  const bind = useMemo(() => ({ ref, onFlip, onStateChange: setState }), [onFlip]);

  return { ref, page, pageCount, state, flipNext, flipPrev, flipTo, bind };
}
