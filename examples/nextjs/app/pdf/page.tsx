import { PdfBook } from "../PdfBook";

// The PDF lives in /public, so it is served from the same origin.
export default function PdfPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <PdfBook url="/sample.pdf" />
    </div>
  );
}
