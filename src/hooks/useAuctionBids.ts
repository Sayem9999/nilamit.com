'use client';

import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getClientDB } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';

export type RealTimeBid = {
  amount:     number;
  endTime:    Date | string;
  bidderName: string;
};

export function useAuctionBids(auctionId: string) {
  const [newBids,        setNewBids]        = useState<RealTimeBid[]>([]);
  const [currentEndTime, setCurrentEndTime] = useState<Date | string | null>(null);

  useEffect(() => {
    let mounted = true;
    const db = getClientDB();

    // Subscribe to latest bid state (server uses rtdbSet → overwrites on each bid)
    const bidRef = ref(db, RTDB_PATHS.auctionBid(auctionId));
    const unsubBid = onValue(bidRef, (snapshot) => {
      if (!mounted) return;
      const data = snapshot.val();
      if (!data) return;

      if (data.event === FIREBASE_EVENTS.NEW_BID) {
        const bid: RealTimeBid = {
          amount:     data.amount,
          endTime:    data.endTime,
          bidderName: data.bidderName ?? 'Someone',
        };
        // Production: Keep only the last 10 bids to avoid memory bloat on active pages
        setNewBids(prev => [bid, ...prev].slice(0, 10));
        if (data.endTime) setCurrentEndTime(data.endTime);
      } else if (
        data.event === FIREBASE_EVENTS.AUCTION_SOLD ||
        data.event === FIREBASE_EVENTS.AUCTION_CLOSED
      ) {
        // Reflect sold/closed state
        if (data.endTime) setCurrentEndTime(data.endTime);
      }
    });

    return () => {
      mounted = false;
      unsubBid();
    };
  }, [auctionId]);

  return { newBids, currentEndTime };
}
