"use client";

import { useEffect } from "react";
import { recordAuctionView } from "@/actions/auction-view";

/**
 * Fire-and-forget view tracker. Mounts on the auction detail page; waits
 * ~1.2s after first paint to filter bot/scraper hits that don't dwell,
 * then bumps the auction's denormalized viewCount via a rate-limited
 * Server Action.
 *
 * Renders null — purely a side-effect component.
 *
 * Why client-side: keeps the auction-detail page's server render path
 * pure (Firestore reads only). View tracking is best-effort engagement
 * analytics, not auction state — should never block the page or fail
 * the user's request.
 */
export function AuctionViewTracker({ auctionId }: { auctionId: string }) {
  useEffect(() => {
    if (!auctionId) return;
    const timer = setTimeout(() => {
      void recordAuctionView(auctionId).catch(() => {
        // Counters are best-effort; swallow failures silently.
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [auctionId]);

  return null;
}
