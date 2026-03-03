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
  const [viewers, setViewers] = useState<number>(0);

  useEffect(() => {
    // Phase 4: Use Presence Channels
    const channelName = `presence-auction-${auctionId}`;
    const channel = pusherClient.subscribe(channelName);

    channel.bind('pusher:subscription_succeeded', (members: any) => {
      setViewers(members.count);
    });

    channel.bind('pusher:member_added', () => {
      setViewers((prev) => prev + 1);
    });

    channel.bind('pusher:member_removed', () => {
      setViewers((prev) => Math.max(0, prev - 1));
    });

    // Listen for the 'new-bid' event fired from actions/bid.ts
    channel.bind('new-bid', (data: RealTimeBid) => {
      setNewBids((prev) => [data, ...prev]);
      if (data.endTime) {
        setCurrentEndTime(data.endTime);
      }
    });

    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
    };
  }, [auctionId]);

  return { newBids, currentEndTime, viewers };
}
