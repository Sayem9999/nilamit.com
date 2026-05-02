'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { triggerSecondChanceOffer } from '@/actions/auction';
import { toast } from 'react-hot-toast';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  auctionId: string;
}

export function SecondChanceOfferButton({ auctionId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleTrigger = async () => {
    if (!confirm('Are you sure you want to offer a second chance to the next bidder? This will cancel the original winner\'s claim.')) return;

    setLoading(true);
    try {
      const res = await triggerSecondChanceOffer(auctionId);
      if (res.success) {
        toast.success('Second chance offer sent to the next bidder!');
        router.refresh();
      } else {
        toast.error(res.error?.message || 'Failed to trigger second chance offer.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred.');
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
