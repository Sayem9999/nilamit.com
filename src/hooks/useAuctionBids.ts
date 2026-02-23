'use client';

import { useEffect, useState } from 'react';
import { pusherClient } from '@/lib/pusher-client';

export type RealTimeBid = {
  amount: number;
  endTime: Date | string;
  bidderName: string;
};

export function useAuctionBids(auctionId: string) {
  const [newBids, setNewBids] = useState<RealTimeBid[]>([]);
  const [currentEndTime, setCurrentEndTime] = useState<Date | string | null>(null);

  useEffect(() => {
    // Subscribe to the specific auction's channel
    const channelName = `auction-${auctionId}`;
    const channel = pusherClient.subscribe(channelName);

    // Listen for the 'new-bid' event fired from actions/bid.ts
    channel.bind('new-bid', (data: RealTimeBid) => {
      setNewBids((prev) => [data, ...prev]);
      if (data.endTime) {
        setCurrentEndTime(data.endTime);
      }
    });

    return () => {
      channel.unbind('new-bid');
      pusherClient.unsubscribe(channelName);
    };
  }, [auctionId]);

  return { newBids, currentEndTime };
}
