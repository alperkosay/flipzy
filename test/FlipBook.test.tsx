import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlipBook, type FlipBookHandle } from "../src";

afterEach(cleanup);

const visiblePages = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-flipzy-page]"))
    .filter((el) => el.style.display !== "none")
    .map((el) => el.dataset.flipzyPage);

const book = (props: Partial<React.ComponentProps<typeof FlipBook>> = {}) => (
  <FlipBook width={200} height={300} mode="double" {...props}>
    <div>Cover</div>
    <div>One</div>
    <div>Two</div>
    <div>Three</div>
    <div>Back</div>
  </FlipBook>
);

describe("FlipBook", () => {
  it("renders the cover alone on the first spread", () => {
    const { container } = render(book());
    expect(visiblePages(container)).toEqual(["0"]);
  });

  it("supports single mode", () => {
    const { container } = render(book({ mode: "single", startPage: 2 }));
    expect(visiblePages(container)).toEqual(["2"]);
  });

  it("flips through the ref API and reports the new page", () => {
    const ref = createRef<FlipBookHandle>();
    const onFlip = vi.fn();
    const { container } = render(book({ ref, onFlip }));
    act(() => ref.current!.flipTo(3, { animate: false }));
    expect(visiblePages(container)).toEqual(["3", "4"]);
    expect(onFlip).toHaveBeenCalledWith({ page: 3, pageCount: 5 });
    expect(ref.current!.getCurrentPage()).toBe(3);
    expect(ref.current!.getPageCount()).toBe(5);
  });

  it("ignores out-of-range and invalid page numbers", () => {
    const ref = createRef<FlipBookHandle>();
    const { container } = render(book({ ref }));
    act(() => ref.current!.flipTo(Number.NaN, { animate: false }));
    act(() => ref.current!.flipTo(-10, { animate: false }));
    expect(visiblePages(container)).toEqual(["0"]);
    act(() => ref.current!.flipTo(999, { animate: false }));
    expect(visiblePages(container)).toEqual(["3", "4"]);
  });

  it("animates a flip and ends on the next spread", async () => {
    const ref = createRef<FlipBookHandle>();
    const states: string[] = [];
    const { container } = render(book({ ref, flipDuration: 40, onStateChange: (s) => states.push(s) }));
    act(() => ref.current!.flipNext());
    expect(states).toEqual(["flipping"]);
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(states).toEqual(["flipping", "idle"]);
    expect(visiblePages(container)).toEqual(["1", "2"]);
  });

  it("flips with the keyboard", () => {
    const { container, getByRole } = render(book({ flipDuration: 0 }));
    fireEvent.keyDown(getByRole("region"), { key: "End" });
    expect(visiblePages(container)).toEqual(["3", "4"]);
    fireEvent.keyDown(getByRole("region"), { key: "Home" });
    expect(visiblePages(container)).toEqual(["0"]);
  });

  it("does not crash with invalid sizes", () => {
    expect(() =>
      render(
        <FlipBook width={Number.NaN} height={-1}>
          <div>a</div>
        </FlipBook>,
      ),
    ).not.toThrow();
  });

  it("renders page content as text, never as HTML", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <FlipBook width={200} height={300}>
        <div>{payload}</div>
      </FlipBook>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it("renders on the server without touching browser globals", () => {
    const html = renderToString(book());
    expect(html).toContain("Cover");
    expect(html).toContain('aria-roledescription="flipbook"');
  });

  it("exposes class names and data attributes for styling", () => {
    const { container } = render(book({ className: "my-book", startPage: 1 }));
    const root = container.querySelector(".flipzy")!;
    expect(root.classList.contains("my-book")).toBe(true);
    const bookEl = root.querySelector<HTMLElement>(".flipzy__book")!;
    expect(bookEl.dataset.spread).toBe("full");
    expect(bookEl.style.getPropertyValue("--flipzy-progress")).toBe("0.5");
    expect(container.querySelector(".flipzy__page--left.flipzy__page--static")?.textContent).toBe("One");
    expect(container.querySelector(".flipzy__page--right.flipzy__page--static")?.textContent).toBe("Two");
  });

  it("marks the cover spread so the theme can hide the empty half", () => {
    const { container } = render(book());
    expect(container.querySelector<HTMLElement>(".flipzy__book")!.dataset.spread).toBe("cover");
  });

  it("lifts a corner on hover without changing state or page", async () => {
    const states: string[] = [];
    const { container } = render(book({ onStateChange: (s) => states.push(s) }));
    const bookEl = container.querySelector<HTMLElement>(".flipzy__book")!;
    // jsdom has no layout, so client coordinates equal book coordinates: bottom-right corner.
    fireEvent.pointerMove(bookEl, { pointerType: "mouse", clientX: 395, clientY: 295 });
    expect(bookEl.dataset.state).toBe("peek");
    expect(visiblePages(container)).toEqual(expect.arrayContaining(["0", "2"]));
    fireEvent.pointerLeave(bookEl);
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(bookEl.dataset.state).toBe("idle");
    expect(visiblePages(container)).toEqual(["0"]);
    expect(states).toEqual([]);
  });

  it("does not peek for touch input or when disabled", () => {
    const { container } = render(book({ hoverPeek: false }));
    const bookEl = container.querySelector<HTMLElement>(".flipzy__book")!;
    fireEvent.pointerMove(bookEl, { pointerType: "mouse", clientX: 395, clientY: 295 });
    expect(bookEl.dataset.state).toBe("idle");
    cleanup();
    const touch = render(book()).container.querySelector<HTMLElement>(".flipzy__book")!;
    fireEvent.pointerMove(touch, { pointerType: "touch", clientX: 395, clientY: 295 });
    expect(touch.dataset.state).toBe("idle");
  });

  it("stops its animation on unmount", async () => {
    const ref = createRef<FlipBookHandle>();
    const onFlip = vi.fn();
    const { unmount } = render(book({ ref, onFlip, flipDuration: 40 }));
    act(() => ref.current!.flipNext());
    unmount();
    await new Promise((r) => setTimeout(r, 150));
    expect(onFlip).not.toHaveBeenCalled();
  });
});
