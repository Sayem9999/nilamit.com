"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Real-User-Monitoring reporter. Mounts once near the root; subscribes
 * to the browser's PerformanceObserver via the web-vitals API surface
 * and POSTs each metric to /api/rum which ships to BigQuery.
 *
 * Uses dynamic import so the ~3KB web-vitals lib doesn't ship in the
 * initial bundle — it's loaded after first paint, on the idle queue.
 *
 * Session id is held in sessionStorage so all vitals from one tab
 * correlate; cleared when the tab closes (no PII).
 */
export function WebVitalsReporter() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("nilamit-rum-sid") ?? "";
      if (!sessionId) {
        sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem("nilamit-rum-sid", sessionId);
      }
    } catch {
      // Storage blocked (Safari private mode) — fall back to per-load id.
      sessionId = `nostore-${Math.random().toString(36).slice(2, 10)}`;
    }

    const path = pathname || "/";

    const ship = (metric: {
      name: string;
      value: number;
      rating?: string;
    }) => {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        path,
        sessionId,
      });
      // Prefer sendBeacon for unloads — fire-and-forget, no response blocking.
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/rum", blob);
      } else {
        void fetch("/api/rum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const idle = (cb: () => void) =>
      "requestIdleCallback" in window
        ? (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb)
        : setTimeout(cb, 1);

    idle(() => {
      void import("web-vitals")
        .then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
          onLCP(ship);
          onCLS(ship);
          onINP(ship);
          onFCP(ship);
          onTTFB(ship);
        })
        .catch(() => {
          // web-vitals not installed yet — no-op gracefully. Install with:
          //   npm install web-vitals
        });
    });
  }, [pathname]);

  return null;
}
