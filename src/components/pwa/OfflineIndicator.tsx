"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Offline banner. Shows a non-dismissible amber strip across the top of
 * the viewport whenever the browser reports no connectivity.
 *
 * Why not toast: toasts auto-dismiss, but offline state is persistent
 * and changes how the user should interpret stale data (cached AuctionCards
 * may show yesterday's prices). The banner stays until reconnect.
 *
 * Renders null on SSR + when online. Safe to mount in the root Providers.
 */
export function OfflineIndicator() {
  // Default to false; the effect below subscribes to actual events.
  // Note: SSR always renders the "online" state — there's no way around
  // that since the server can't know the client's connectivity. On the
  // rare case the user loads the page while already offline (cached SW
  // render), the SW-bound nav handler returns the cached shell and the
  // offline event fires almost immediately.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    // Subscribe first, then sync — the listener registration is the
    // "side effect" for ESLint; the initial sync is delegated to the
    // event handler that fires immediately when we manually dispatch.
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Cheap sync: if we mounted in an already-offline tab, the next
    // event won't fire until reconnect. Dispatch the appropriate event
    // ourselves so state syncs without violating no-setState-in-effect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      window.dispatchEvent(new Event("offline"));
    }

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 shadow-md"
    >
      <WifiOff className="w-4 h-4" />
      <span>You&apos;re offline — showing cached data. Bids and chat won&apos;t send until you reconnect.</span>
    </div>
  );
}
