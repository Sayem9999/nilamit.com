'use client';

/**
 * Seller-side Best Offer inbox — shows on the seller's own live listing.
 * Accepting sells the auction at the offered price through the same escrow
 * path as Buy It Now; all other pending offers auto-decline.
 */
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getAuctionOffers, respondToOffer } from '@/actions/offer';
import type { OfferDoc } from '@/services/offer-service';
import { formatBDT } from '@/lib/format';
import { HandCoins, Loader2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function SellerOffersPanel({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferDoc[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    getAuctionOffers(auctionId).then((res) => {
      if (mounted && res.success) setOffers(res.data ?? []);
    });
    return () => {
      mounted = false;
    };
  }, [auctionId]);

  const respond = useCallback(
    (offerId: string, response: 'ACCEPT' | 'DECLINE', amount: number) => {
      if (
        response === 'ACCEPT' &&
        !confirm(`Accept this offer and sell for ${formatBDT(amount)}? This ends the auction immediately.`)
      ) {
        return;
      }
      startTransition(async () => {
        const res = await respondToOffer({ offerId, response });
        if (res.success) {
          toast.success(response === 'ACCEPT' ? 'Offer accepted — sale created!' : 'Offer declined.');
          if (response === 'ACCEPT') {
            router.refresh();
          } else {
            setOffers((prev) =>
              prev?.map((o) => (o.id === offerId ? { ...o, status: 'DECLINED' as const } : o)) ?? null,
            );
          }
        } else {
          toast.error(res.error?.message || 'Could not respond to the offer.');
        }
      });
    },
    [router],
  );

  const pending = offers?.filter((o) => o.status === 'PENDING') ?? [];
  if (!offers || pending.length === 0) return null;

  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <HandCoins className="h-4 w-4 text-amber-600" />
        Offers on your listing
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
          {pending.length}
        </span>
      </h3>
      <ul className="space-y-2">
        {pending.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="price text-base font-bold text-gray-900">{formatBDT(o.amount)}</p>
              <p className="truncate text-xs text-gray-500">
                {o.buyerName ?? 'A buyer'}
                {o.message ? ` — “${o.message}”` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => respond(o.id, 'ACCEPT', o.amount)}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-gray-300"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Accept
              </button>
              <button
                type="button"
                onClick={() => respond(o.id, 'DECLINE', o.amount)}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
