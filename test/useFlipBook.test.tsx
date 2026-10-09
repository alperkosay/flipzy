import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FlipBook, useFlipBook } from "../src";

afterEach(cleanup);

function Harness() {
  const book = useFlipBook();
  const [count, setCount] = useState<number | null>(null);
  return (
    <>
      <output data-testid="state">
        {book.page}/{book.pageCount}
      </output>
      <button onClick={() => setCount(4)}>load</button>
      <button onClick={() => setCount(7)}>more</button>
      <button onClick={() => book.flipTo(3, { animate: false })}>jump</button>
      {count !== null && (
        <FlipBook width={100} height={140} {...book.bind}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i}>{i}</div>
          ))}
        </FlipBook>
      )}
    </>
  );
}

describe("useFlipBook", () => {
  it("tracks a book that mounts later and whose page count changes", () => {
    render(<Harness />);
    expect(screen.getByTestId("state").textContent).toBe("0/0");
    act(() => screen.getByText("load").click());
    expect(screen.getByTestId("state").textContent).toBe("0/4");
    act(() => screen.getByText("more").click());
    expect(screen.getByTestId("state").textContent).toBe("0/7");
    act(() => screen.getByText("jump").click());
    expect(screen.getByTestId("state").textContent).toBe("3/7");
  });
});
