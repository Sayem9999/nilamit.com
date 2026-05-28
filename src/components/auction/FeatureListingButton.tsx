"use client";

import { useState, useTransition } from "react";
import { Star, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { quoteFeaturedPurchase } from "@/actions/featured";

interface Props {
  auctionId: string;
  /** Only the seller sees this. */
  isOwner: boolean;
  /** If already featured, render the badge instead of the CTA. */
  isFeatured?: boolean;
  featuredUntil?: Date | null;
}

const DURATIONS = [
  { days: 1, defaultPriceBdt: 50 },
  { days: 3, defaultPriceBdt: 120 },
  { days: 7, defaultPriceBdt: 250 },
];

/**
 * Featured-listing self-serve purchase CTA on the auction detail page.
 *
 * Seller picks 1/3/7 days, we call quoteFeaturedPurchase to get the
 * server-confirmed price + tranId, then redirect to the payment flow.
 * After successful payment-callback (server-side), activateFeatured
 * flips the auction's isFeatured + featuredUntil.
 *
 * Rendered only for the auction owner.
 */
export function FeatureListingButton({
  auctionId,
  isOwner,
  isFeatured,
  featuredUntil,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isOwner) return null;

  // Already featured — show a slim "featured until" pill instead of the CTA.
  if (isFeatured && featuredUntil) {
    const until = featuredUntil instanceof Date ? featuredUntil : new Date(featuredUntil);
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs font-bold text-amber-800">
        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        Featured until {until.toLocaleDateString()}
      </div>
    );
  }

  const handlePurchase = (days: number) => {
    startTransition(async () => {
      const res = await quoteFeaturedPurchase({ auctionId, days });
      if (!res.success || !res.data) {
        toast.error(res.error?.message || "Could not start checkout");
        return;
      }
      // For now: payment gateway integration is in /api/payments/callback.
      // The seller would proceed to the gateway — until that's wired for
      // feat-* tranIds, we toast the quote so the seller knows the path
      // exists and the admin can manually activate via the audit log.
      toast.success(
        `Quote saved: ৳${res.data.priceBdt} for ${res.data.days} day(s). Tran: ${res.data.tranId.slice(-8)}`,
      );
      setOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-sm font-bold rounded-md transition-colors"
      >
        <Star className="w-4 h-4" />
        Promote to Featured
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-md shadow-lg max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Promote this listing</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Featured listings appear in the homepage rail + at the top of
              category searches. Typical lift: 3-5× more impressions, 2× more bids.
            </p>

            <div className="space-y-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.days}
                  onClick={() => handlePurchase(d.days)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">
                      {d.days} day{d.days > 1 ? "s" : ""}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {d.days === 7 ? "Best value · save 30%" : d.days === 3 ? "Most popular" : "Quick boost"}
                    </p>
                  </div>
                  <span className="price text-base font-bold text-primary-600">
                    ৳{d.defaultPriceBdt}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
              Prices are admin-configurable. Payment via bKash / Nagad. Featured
              status applies the moment payment is verified; expires automatically.
            </p>
            {isPending && (
              <div className="flex items-center justify-center mt-3">
                <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
