'use client';

/**
 * Best Offer entry point — renders below the bid box on live listings.
 * Collapsed by default; expands into an amount + optional message form.
 */
import { useCallback, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { makeOffer } from '@/actions/offer';
import { formatBDT } from '@/lib/format';
import { HandCoins, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface MakeOfferButtonProps {
  auctionId: string;
  /** Live current price — offers must beat it once bids exist. */
  currentPrice: number;
  bidCount: number;
  buyItNowPrice?: number | null;
}

export function MakeOfferButton({ auctionId, currentPrice, bidCount, buyItNowPrice }: MakeOfferButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(() => {
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid offer amount.');
      return;
    }
    startTransition(async () => {
      const res = await makeOffer({ auctionId, amount: value, message: message || undefined });
      if (res.success) {
        setSent(value);
        setOpen(false);
        toast.success('Offer sent! The seller will be notified.');
      } else {
        toast.error(res.error?.message || 'Could not send your offer.');
      }
    });
  }, [auctionId, amount, message]);

  if (!session?.user?.id) return null;

  if (sent) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <Check className="h-4 w-4 shrink-0" />
        Offer of {formatBDT(sent)} sent — you&apos;ll be notified when the seller responds.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 w-full rounded-md border border-dashed border-primary-300 bg-primary-50/50 px-4 py-2.5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50 flex items-center justify-center gap-2"
      >
        <HandCoins className="h-4 w-4" />
        Make an Offer
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-md border border-primary-200 bg-primary-50/40 p-3">
      <label htmlFor="offer-amount-input" className="mb-1 block text-xs font-medium text-gray-500">
        Your offer (Tk)
      </label>
      <input
        id="offer-amount-input"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min={1}
        placeholder={bidCount > 0 ? `More than ${formatBDT(currentPrice)}` : 'Name your price'}
        className="price w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-lg outline-none focus:ring-2 focus:ring-primary-500"
      />
      {buyItNowPrice ? (
        <p className="mt-1 text-[11px] text-gray-400">
          Buy It Now is {formatBDT(buyItNowPrice)} — offers at or above that should just buy it.
        </p>
      ) : null}
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 300))}
        placeholder="Optional message to the seller"
        className="mt-2 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
          Send Offer
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
