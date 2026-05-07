'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { triggerSecondChanceOffer } from '@/actions/auction';
import { toast } from 'react-hot-toast';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Props {
  auctionId: string;
}

export function SecondChanceOfferButton({ auctionId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations('SecondChance');
  const tc = useTranslations('Common');

  const handleTrigger = async () => {
    if (!confirm("Offer this auction to the next-highest bidder? This cancels the original winner's claim.")) return;

    setLoading(true);
    try {
      const res = await triggerSecondChanceOffer(auctionId);
      if (res.success) {
        toast.success(t('sent'));
        router.refresh();
      } else {
        toast.error(res.error?.message || t('failed'));
      }
    } catch {
      toast.error(tc('unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
      onClick={handleTrigger}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCcw className="w-4 h-4" />
      )}
      Second Chance Offer
    </Button>
  );
}
