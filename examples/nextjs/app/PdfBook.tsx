"use client";

import { useEffect, useState } from "react";
import { FlipBook, useFlipBook } from "flipzy";

interface PdfBookProps {
  /** PDF address. Same-origin files (e.g. from /public) avoid CORS issues. */
  url: string;
}

/**
 * Renders each PDF page to an image with pdf.js and shows them in a FlipBook.
 * Pages appear one by one as they are rendered.
 */
export function PdfBook({ url }: PdfBookProps) {
  const book = useFlipBook();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [pages, setPages] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    let destroy: (() => void) | undefined;

    (async () => {
      // pdf.js uses browser APIs as soon as it loads, so import it only in the browser.
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(
        new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );

      const task = pdfjs.getDocument({ url });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
      if (cancelled) return;
      setSize({ width: first.width, height: first.height });
      setPages(Array<string | null>(pdf.numPages).fill(null));

      // Sharp on high-density screens without huge images.
      const scale = Math.min(window.devicePixelRatio || 1, 2) * 1.25;
      for (let i = 1; i <= pdf.numPages && !cancelled; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        page.cleanup();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
        if (!blob || cancelled) break;
        const src = URL.createObjectURL(blob);
        objectUrls.push(src);
        setPages((prev) => prev.map((p, index) => (index === i - 1 ? src : p)));
      }
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      destroy?.();
      for (const src of objectUrls) URL.revokeObjectURL(src);
    };
  }, [url]);

  if (error) return <p role="alert">PDF açılamadı: {error}</p>;
  if (!size) return <p style={{ textAlign: "center" }}>PDF yükleniyor…</p>;

  return (
    <div>
      <FlipBook width={size.width} height={size.height} aria-label="PDF kitap" {...book.bind}>
        {pages.map((src, i) =>
          src ? (
            <img key={i} src={src} alt={`Sayfa ${i + 1}`} draggable={false} />
          ) : (
            <div key={i} style={skeletonStyle}>
              Sayfa {i + 1} hazırlanıyor…
            </div>
          ),
        )}
      </FlipBook>
      <div className="flipzy-controls">
        <button className="flipzy-button" onClick={book.flipPrev} disabled={book.page === 0}>
          ← Önceki
        </button>
        <span className="flipzy-counter">
          {book.page + 1} / {book.pageCount}
        </span>
        <button className="flipzy-button" onClick={book.flipNext} disabled={book.page >= book.pageCount - 1}>
          Sonraki →
        </button>
      </div>
    </div>
  );
}

const skeletonStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9a8f80",
  font: "14px system-ui, sans-serif",
  background: "linear-gradient(100deg, #f6f1e7 30%, #fbf8f1 50%, #f6f1e7 70%)",
} as const;
