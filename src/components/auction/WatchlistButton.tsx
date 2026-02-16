'use client';

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { toggleWatchlist } from '@/actions/watchlist';
import { toast } from 'react-hot-toast';

interface WatchlistButtonProps {
  auctionId: string;
  initialIsWatched: boolean;
}

export function WatchlistButton({ auctionId, initialIsWatched }: WatchlistButtonProps) {
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const res = await toggleWatchlist(auctionId);
      if (res.success) {
        setIsWatched(res.watched!);
        toast.success(res.watched ? 'Added to watchlist' : 'Removed from watchlist');
      } else {
        toast.error(res.error || 'Failed to update watchlist');
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`p-2 rounded-full border transition-all ${
        isWatched 
          ? 'bg-rose-50 border-rose-100 text-rose-500 shadow-sm' 
          : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600'
      } disabled:opacity-50`}
      title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <Heart className={`w-5 h-5 ${isWatched ? 'fill-current' : ''}`} />
    </button>
  );
}
