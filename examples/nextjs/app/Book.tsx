"use client";

import { useState } from "react";
import { FlipBook, useFlipBook } from "flipzy";

const chapters = ["Prologue", "The Harbour", "Night Train", "Letters", "The Garden", "Winter", "Epilogue", "Notes"];

export function Book() {
  const book = useFlipBook();
  const [dark, setDark] = useState(false);

  return (
    <div
      className={dark ? "flipzy-theme-dark" : undefined}
      style={{ maxWidth: 960, margin: "0 auto", padding: 24, borderRadius: 16, background: dark ? "#17181b" : "transparent" }}
    >
      <FlipBook width={420} height={580} aria-label="Sample book" {...book.bind}>
        <div style={coverStyle}>
          <h1 style={{ fontSize: 44, margin: 0 }}>flipzy</h1>
          <p style={{ opacity: 0.8 }}>Drag a corner, click a page, or use the arrow keys.</p>
        </div>
        {chapters.map((title, i) => (
          <article key={title} style={pageStyle}>
            <small style={{ opacity: 0.6 }}>Chapter {i + 1}</small>
            <h2 style={{ margin: "4px 0 16px" }}>{title}</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
            </p>
            {i === 1 && <a href="https://www.npmjs.com/package/flipzy">Links inside pages still work</a>}
          </article>
        ))}
        <div style={coverStyle}>
          <p>The End</p>
        </div>
      </FlipBook>

      <div className="flipzy-controls">
        <button className="flipzy-button" onClick={book.flipPrev} disabled={book.page === 0}>
          ← Previous
        </button>
        <span className="flipzy-counter">
          {book.page + 1} / {book.pageCount}
        </span>
        <button className="flipzy-button" onClick={book.flipNext} disabled={book.page >= book.pageCount - 1}>
          Next →
        </button>
        <button className="flipzy-button" onClick={() => setDark((d) => !d)}>
          {dark ? "Light" : "Dark"}
        </button>
      </div>
    </div>
  );
}

const pageStyle = {
  width: "100%",
  height: "100%",
  padding: "48px 40px",
  boxSizing: "border-box",
  fontFamily: "Georgia, serif",
  lineHeight: 1.7,
} as const;

const coverStyle = {
  width: "100%",
  height: "100%",
  padding: 48,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  background: "linear-gradient(150deg, #2d4a6b, #1c2f45)",
  color: "#f5efe0",
  fontFamily: "Georgia, serif",
} as const;
