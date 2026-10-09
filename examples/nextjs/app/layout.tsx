import Link from "next/link";
import "flipzy/styles.css";

export const metadata = { title: "flipzy example" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, padding: 24, background: "#ebe6dc", fontFamily: "system-ui, sans-serif" }}>
        <nav style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 16 }}>
          <Link href="/">React sayfaları</Link>
          <Link href="/pdf">PDF'ten flipbook</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
