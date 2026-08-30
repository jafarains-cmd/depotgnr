"use client";

import { useEffect, useState } from "react";

type CapturedError = {
  id: number;
  ts: string;
  kind: "error" | "unhandledrejection" | "fetch";
  message: string;
  source?: string;
  stack?: string;
};

/**
 * Debug overlay yang cuma aktif di Capacitor Android WebView.
 * Nangkep unhandled error + rejection + fetch fail, tampilin sebagai
 * banner merah di bawah supaya bisa langsung dibaca user tanpa perlu
 * Chrome DevTools remote debug.
 *
 * Kalau bukan di WebView (browser desktop / mobile web), komponen ini
 * return null — nol overhead.
 *
 * Setelah error visible + root cause ketemu, comment/hapus mount-nya
 * dari layout.tsx sebelum publish production.
 */
export function WebViewErrorOverlay() {
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [isWebView, setIsWebView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent || "";
    const inWebView =
      /wv\)/i.test(ua) ||
      /; wv;/i.test(ua) ||
      typeof (window as unknown as { Capacitor?: unknown }).Capacitor !==
        "undefined";
    if (!inWebView) return;
    setIsWebView(true);

    let counter = 0;
    const push = (e: Omit<CapturedError, "id" | "ts">) => {
      counter += 1;
      const item: CapturedError = {
        ...e,
        id: counter,
        ts: new Date().toLocaleTimeString("id-ID", { hour12: false }),
      };
      setErrors((prev) => [...prev, item].slice(-20));
    };

    function onError(event: ErrorEvent) {
      push({
        kind: "error",
        message: event.message || String(event.error) || "unknown error",
        source: event.filename
          ? `${event.filename}:${event.lineno}:${event.colno}`
          : undefined,
        stack: event.error?.stack,
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      push({
        kind: "unhandledrejection",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : JSON.stringify(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Wrap fetch untuk catch network fail
    const origFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const res = await origFetch(...args);
        if (!res.ok && res.status >= 500) {
          const url = typeof args[0] === "string" ? args[0] : args[0].toString();
          push({
            kind: "fetch",
            message: `HTTP ${res.status} ${res.statusText}`,
            source: url,
          });
        }
        return res;
      } catch (err) {
        const url = typeof args[0] === "string" ? args[0] : args[0].toString();
        push({
          kind: "fetch",
          message: err instanceof Error ? err.message : String(err),
          source: url,
        });
        throw err;
      }
    };

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.fetch = origFetch;
    };
  }, []);

  if (!isWebView || errors.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        background: "#7f1d1d",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 11,
        maxHeight: collapsed ? 32 : "40vh",
        overflow: "auto",
        borderTop: "2px solid #dc2626",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 10px",
          background: "#991b1b",
          position: "sticky",
          top: 0,
        }}
      >
        <strong>
          🐛 {errors.length} WebView error{errors.length > 1 ? "s" : ""}
        </strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: "#fff",
              color: "#7f1d1d",
              border: "none",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {collapsed ? "Show" : "Hide"}
          </button>
          <button
            onClick={() => setErrors([])}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid #fff",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: 10 }}>
          {errors.map((e) => (
            <div
              key={e.id}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: "1px dashed rgba(255,255,255,0.3)",
              }}
            >
              <div>
                <span style={{ opacity: 0.7 }}>[{e.ts}]</span>{" "}
                <span
                  style={{
                    background: "#fff",
                    color: "#7f1d1d",
                    padding: "0 4px",
                    borderRadius: 2,
                    fontWeight: 700,
                  }}
                >
                  {e.kind}
                </span>{" "}
                {e.message}
              </div>
              {e.source && (
                <div style={{ opacity: 0.75, marginTop: 2 }}>@ {e.source}</div>
              )}
              {e.stack && (
                <pre
                  style={{
                    margin: "4px 0 0",
                    whiteSpace: "pre-wrap",
                    fontSize: 10,
                    opacity: 0.7,
                  }}
                >
                  {e.stack.split("\n").slice(0, 5).join("\n")}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
