'use client';

import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getClientDB } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';

export function useAuctionPrice(auctionId: string, initialPrice: number, initialBidCount: number, initialStatus: string = 'ACTIVE') {
  const [currentPrice, setCurrentPrice] = useState(initialPrice);
  const [bidCount, setBidCount] = useState(initialBidCount);
  const [status, setStatus] = useState(initialStatus);

  // Sync state if auction changes (e.g. navigation)
  const [prevId, setPrevId] = useState(auctionId);
  if (auctionId !== prevId) {
    setPrevId(auctionId);
    setCurrentPrice(initialPrice);
    setBidCount(initialBidCount);
    setStatus(initialStatus);
  }

  useEffect(() => {
    let mounted = true;
    const db = getClientDB();

    const bidRef = ref(db, RTDB_PATHS.auctionBid(auctionId));
    const unsubBid = onValue(bidRef, (snapshot) => {
      if (!mounted) return;
      const data = snapshot.val();
      if (!data) return;

      if (data.event === FIREBASE_EVENTS.NEW_BID) {
        if (data.amount !== undefined) {
          setCurrentPrice(data.amount);
          if (data.bidCount !== undefined) {
            setBidCount(data.bidCount);
          } else {
            setBidCount(prev => prev + 1);
          }
        }
      } else if (data.event === FIREBASE_EVENTS.AUCTION_SOLD || data.event === FIREBASE_EVENTS.AUCTION_CLOSED) {
        if (data.status) setStatus(data.status);
        if (data.amount !== undefined) setCurrentPrice(data.amount);
      }
    });

    return () => {
      mounted = false;
      unsubBid();
    };
  }, [auctionId]);

  return { currentPrice, bidCount, status };
}
