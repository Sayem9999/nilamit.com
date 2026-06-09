"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { FEATURED_TIERS } from "@/services/finance/featured";

interface Props {
  auctionId: string;
  /** Whether the listing is already featured (hides the upsell, shows status). */
  isFeatured?: boolean;
  featuredUntil?: Date | string | null;
}

/**
 * Seller-only "Feature this listing" control. Rendered on the seller's own
 * auction detail page. Picks a tier, calls initiateFeaturedPurchase to get a
 * `feat_` transaction id + price, then hands off to the payment gateway.
 *
 * NOTE: the gateway *init* endpoint doesn't exist on the platform yet (escrow
 * advances share the same gap). When it lands, POST { tranId, amount } to it
 * and redirect to the returned GatewayPageURL — the verified callback already
 * activates the feature via FeaturedService. Until then this surfaces the
 * quote + reserves the transaction id.
 */
export function FeatureListingButton({ auctionId, isFeatured, featuredUntil }: Props) {
  const [selected, setSelected] = useState<number>(FEATURED_TIERS[1]?.days ?? 7);
  const [isPending, startTransition] = useTransition();

  if (isFeatured) {
    const until = featuredUntil ? new Date(featuredUntil) : null;
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 text-sm">Featured listing</h3>
          <p className="text-xs text-amber-800 mt-1">
            This listing is promoted to the top of search and browse
            {until ? ` until ${until.toLocaleDateString()}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  const handlePurchase = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/payments/sslcommerz/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "featured", auctionId, days: selected }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.gatewayUrl) {
          // Hand off to the hosted checkout. The signed callback activates the
          // feature; the expire-featured cron winds it back down.
          window.location.href = data.gatewayUrl as string;
          return;
        }

        if (res.status === 503 && data.code === "GATEWAY_OFF") {
          toast("Online payment isn't enabled yet — contact support to feature this listing.");
          return;
        }

        toast.error(data.error || "Could not start featured purchase");
      } catch {
        toast.error("Network error — please try again.");
      }
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-900">Feature this listing</h3>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        Promoted listings appear at the top of search and browse results —
        sellers typically see materially more views and bids.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {FEATURED_TIERS.map((tier) => {
          const active = selected === tier.days;
          return (
            <button
              key={tier.days}
              type="button"
              onClick={() => setSelected(tier.days)}
              className={`relative rounded-md border p-3 text-center transition-colors ${
                active
                  ? "border-amber-400 bg-amber-50"
                  : "border-gray-200 hover:border-amber-300 hover:bg-gray-50"
              }`}
            >
              {active && (
                <Check className="w-3.5 h-3.5 text-amber-600 absolute top-1.5 right-1.5" />
              )}
              <div className="text-sm font-bold text-gray-900">{tier.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">৳{tier.priceBdt}</div>
            </button>
          );
        })}
      </div>

      <button
        onClick={handlePurchase}
        disabled={isPending}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Feature for ৳{FEATURED_TIERS.find((t) => t.days === selected)?.priceBdt}
          </>
        )}
      </button>
    </div>
  );
}
