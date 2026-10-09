# flipzy

Realistic page-flip (flipbook) component for React and Next.js.

- Drag a corner, click, use the arrow keys, or flip from code
- Single and double page layouts, switching automatically on narrow screens
- Works in the Next.js App Router and Pages Router, including server rendering
- Pages are ordinary React elements: text stays selectable, links and buttons inside pages keep working
- Page corners lift when the mouse hovers over them
- Optional theme stylesheet: light, dark and flat themes, page stack edges, styled controls
- Zero runtime dependencies, about 8.5 kB gzipped, fully typed
- Keyboard and screen reader support, respects `prefers-reduced-motion`

## Install

```bash
npm install flipzy
```

React 18 or 19 is required as a peer dependency.

## Usage

Every child of `FlipBook` is one page.

```tsx
import { FlipBook } from "flipzy";

export default function Magazine() {
  return (
    <FlipBook width={400} height={560}>
      <img src="/cover.jpg" alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <article>Page two</article>
      <article>Page three</article>
      <img src="/back.jpg" alt="Back cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </FlipBook>
  );
}
```

`width` and `height` are the size of one page in pixels. The book keeps that aspect ratio and shrinks to fit its container; it never grows beyond its natural size.

### Next.js

The package ships with a `"use client"` directive, so you can import `FlipBook` directly from a Server Component in the App Router. Page content passed as children can itself be server-rendered.

To control the book with buttons, use a Client Component:

```tsx
"use client";

import { FlipBook, useFlipBook } from "flipzy";

export function Book() {
  const book = useFlipBook();
  return (
    <>
      <FlipBook width={400} height={560} {...book.bind}>
        {/* pages */}
      </FlipBook>
      <button onClick={book.flipPrev} disabled={book.page === 0}>Previous</button>
      <span>
        {book.page + 1} / {book.pageCount}
      </span>
      <button onClick={book.flipNext}>Next</button>
    </>
  );
}
```

### PDF files

flipzy does not read PDFs itself, so it stays dependency-free. Render the pages to images with [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) and pass them as children. [examples/nextjs/app/PdfBook.tsx](./examples/nextjs/app/PdfBook.tsx) is a complete Next.js component that does this, with pages appearing as they are rendered. Keep `pdfjs-dist` up to date: versions before 4.2.67 can run code from a malicious PDF (CVE-2024-4367).

## Props

| Prop                  | Type                                         | Default                  | Description                                                          |
| --------------------- | -------------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| `width`               | `number`                                     | required                 | Width of one page in px                                              |
| `height`              | `number`                                     | required                 | Height of one page in px                                             |
| `startPage`           | `number`                                     | `0`                      | Page shown on first render                                           |
| `mode`                | `"auto" \| "single" \| "double"`             | `"auto"`                 | `auto` shows one page when the container is narrower than 1.5 pages |
| `showCover`           | `boolean`                                    | `true`                   | In double mode, the first page stands alone as a cover               |
| `flipDuration`        | `number`                                     | `700`                    | Duration of an automatic flip in ms                                  |
| `drag`                | `boolean`                                    | `true`                   | Flip by dragging a page                                              |
| `clickToFlip`         | `boolean`                                    | `true`                   | Flip by clicking a page                                              |
| `keyboard`            | `boolean`                                    | `true`                   | Arrow keys, Page Up/Down, Home and End flip when the book has focus  |
| `shadows`             | `boolean`                                    | `true`                   | Fold and gutter shadows                                              |
| `hoverPeek`           | `boolean`                                    | `true`                   | Lift the page corner when the mouse hovers over it                   |
| `onFlip`              | `(e: { page, pageCount }) => void`           |                          | Called after the visible page changes                                |
| `onStateChange`       | `(state: "idle" \| "dragging" \| "flipping")` |                          | Called when the animation state changes                              |
| `getPageAnnouncement` | `(page, pageCount) => string`                | `"Page 3 of 10"`         | Text announced to screen readers; use it to translate                |
| `aria-label`          | `string`                                     | `"Flipbook"`             | Accessible name of the book                                          |
| `className`, `style`  |                                              |                          | Applied to the outer element                                         |

## Ref methods

```tsx
const ref = useRef<FlipBookHandle>(null);
<FlipBook ref={ref} width={400} height={560}>…</FlipBook>;

ref.current?.flipNext();
ref.current?.flipPrev();
ref.current?.flipTo(6); // animated
ref.current?.flipTo(6, { animate: false }); // jump
ref.current?.getCurrentPage();
ref.current?.getPageCount();
```

## Styling

### Optional theme

```tsx
import "flipzy/styles.css";
```

The theme adds a soft shadow under the book, a page stack at the outer edges that grows on the side holding more pages, rounded page corners, a focus ring, and styles for your own navigation controls. The component works without it.

In the Next.js App Router you can import it in any file, for example `app/layout.tsx`. In the Pages Router, import it in `pages/_app.tsx`.

**Themes.** Add a class to the book or to any ancestor. Put it on a wrapper to theme the book and its controls together.

| Class                 | Look                                |
| --------------------- | ----------------------------------- |
| (none)                | Warm paper, page stack, soft shadow |
| `flipzy-theme-dark` | Dark paper and controls             |
| `flipzy-theme-flat` | No page stack, no outer shadow      |

**Controls.** Style your own buttons with the theme's classes:

```tsx
<div className="flipzy-controls">
  <button className="flipzy-button" onClick={book.flipPrev}>Previous</button>
  <span className="flipzy-counter">{book.page + 1} / {book.pageCount}</span>
  <button className="flipzy-button" onClick={book.flipNext}>Next</button>
</div>
```

**Custom properties.** Override any of these on `:root`, a wrapper or the book:

| Property                                    | Default                    | Controls                                     |
| ------------------------------------------- | -------------------------- | -------------------------------------------- |
| `--flipzy-paper`                          | `#fffdf8`                  | Page colour                                  |
| `--flipzy-page-shade`                     | `rgb(60 40 20 / .035)`     | Shading toward the page edges                |
| `--flipzy-page-bg`                        | built from the two above   | Full page background (any CSS `background`)  |
| `--flipzy-radius`                         | `4px`                      | Outer page corner radius                     |
| `--flipzy-edge`                           | `#e4dccb`                  | Page stack line colour                       |
| `--flipzy-edge-size`                      | `6px`                      | Maximum page stack thickness                 |
| `--flipzy-book-shadow`                    | soft drop shadow           | Shadow under the book                        |
| `--flipzy-shadow-strength`                | `1`                        | Fold shadow multiplier (works without theme) |
| `--flipzy-gutter-strength`                | `1`                        | Spine shadow multiplier (works without theme)|
| `--flipzy-focus-ring`                     | `#4f7bd9`                  | Focus outline colour                         |
| `--flipzy-control-bg` / `-fg` / `-border` | white / dark / light grey  | Control colours                              |

Without the theme, set `--flipzy-page-bg` (default `#fff`) to change the page colour.

### Class names and attributes

| Selector                                                     | Element                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `.flipzy`                                                  | Outer element (receives `className` and `style`)              |
| `.flipzy__book`                                            | The book; has `data-mode`, `data-state`, `data-spread` and `--flipzy-progress` (0 to 1) |
| `.flipzy__page`                                            | Each page, with `data-flipzy-page="<index>"`                |
| `.flipzy__page--left` / `--right`                          | Side the page rests on                                        |
| `.flipzy__page--static` / `--front` / `--back` / `--under` | Role while a page turns                                       |

`data-state` is `idle`, `peek`, `dragging` or `flipping`. `data-spread` is `cover`, `back`, `full` or `single`.

Without the stylesheet, every style goes through React's `style` prop, so the component works under a strict Content Security Policy without `'unsafe-inline'` for styles. Elements matching `a[href]`, `button`, `input`, `select`, `textarea`, `label` or `[data-flipzy-no-flip]` never start a flip, so interactive content inside pages works normally.

## Security

See [SECURITY.md](./SECURITY.md) for how to report a vulnerability. Releases are published from GitHub Actions with npm provenance, so you can verify which commit each version was built from.

## License

MIT
