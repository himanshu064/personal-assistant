"use client";

/**
 * Last resort when the root layout itself fails. It replaces the whole page,
 * so it brings its own <html> and plain inline styles (globals.css may not load).
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f3f3f1", fontFamily: "system-ui, sans-serif", color: "#1c1c1b" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 400, fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#74746f", margin: "0 0 20px" }}>Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: 0, background: "#1c1c1b", color: "#fff", fontSize: 15, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
