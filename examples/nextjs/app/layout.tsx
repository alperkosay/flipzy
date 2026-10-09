import "flippero/styles.css";

export const metadata = { title: "flippero example" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 24, background: "#ebe6dc", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
