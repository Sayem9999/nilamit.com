'use client';

import { useTransition } from 'react';
import { triggerSecondChanceOffer } from '@/actions/auction';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SecondChanceButtonProps {
  auctionId: string;
}

export default function SecondChanceButton({ auctionId }: SecondChanceButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleTrigger = () => {
    startTransition(async () => {
      const res = await triggerSecondChanceOffer(auctionId);
      if (res.success) {
        toast.success('Second chance offer sent to the next bidder!');
      } else {
        toast.error(res.error?.message || 'Failed to trigger offer');
      }
    });
  };

  return (
    <button
      onClick={handleTrigger}
      disabled={isPending}
      className="w-full py-2.5 bg-white border border-primary-200 text-primary-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <RefreshCw className="w-3 h-3" />
      )}
      Offer Second Chance
    </button>
  );
}
