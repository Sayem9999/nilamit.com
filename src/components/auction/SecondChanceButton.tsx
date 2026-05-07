'use client';

import { useTransition } from 'react';
import { triggerSecondChanceOffer } from '@/actions/auction';
import { RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface SecondChanceButtonProps {
  auctionId: string;
}

export default function SecondChanceButton({ auctionId }: SecondChanceButtonProps) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('SecondChance');

  const handleTrigger = () => {
    startTransition(async () => {
      const res = await triggerSecondChanceOffer(auctionId);
      if (res.success) {
        toast.success(t('sent'));
      } else {
        toast.error(res.error?.message || t('failed'));
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleTrigger}
      disabled={isPending}
      aria-label="Offer this auction to the next-highest bidder"
      className="w-full py-2.5 bg-white border border-primary-200 text-primary-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw className="w-3 h-3" aria-hidden="true" />
      )}
      Offer Second Chance
    </button>
  );
}
