'use client';

import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getClientDB } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';

export type RealTimeBid = {
  id:         string;
  amount:     number;
  endTime:    Date | string;
  bidderName: string;
  bidderId:   string;
  createdAt:  string;
};

export interface UseAuctionBidsOptions {
  /**
   * Server-rendered initial bids — populates the live list before the first
   * RTDB event arrives, so a page refresh on a busy auction doesn't show an
   * empty "live" panel until the next bid lands.
   */
  initialBids?: RealTimeBid[];
}

export function useAuctionBids(auctionId: string, options: UseAuctionBidsOptions = {}) {
  const [newBids,        setNewBids]        = useState<RealTimeBid[]>(options.initialBids ?? []);
  const [currentEndTime, setCurrentEndTime] = useState<Date | string | null>(null);
  const [status,         setStatus]         = useState<string | null>(null);
  const [isConnected,    setIsConnected]    = useState(true);

  useEffect(() => {
    let mounted = true;
    const db = getClientDB();

    const connectedRef = ref(db, ".info/connected");
    const unsubConn = onValue(connectedRef, (snap) => {
      if (mounted) setIsConnected(!!snap.val());
    });

    const bidRef = ref(db, RTDB_PATHS.auctionBid(auctionId));
    const unsubBid = onValue(bidRef, (snapshot) => {
      if (!mounted) return;
      const data = snapshot.val();
      if (!data) return;

      if (data.event === FIREBASE_EVENTS.NEW_BID) {
        const bid: RealTimeBid = {
          id:         data.id || `rt_${Date.now()}`,
          amount:     data.amount,
          endTime:    data.endTime,
          bidderName: data.bidderName ?? 'Someone',
          bidderId:   data.bidderId || 'unknown',
          createdAt:  data.createdAt || new Date().toISOString(),
        };
        // Prepend, dedupe by id (server hydration may overlap with the latest
        // RTDB event), keep the 10 most recent.
        setNewBids(prev => {
          const next = [bid, ...prev.filter(b => b.id !== bid.id)];
          return next.slice(0, 10);
        });
        if (data.endTime) setCurrentEndTime(data.endTime);
      } else if (
        data.event === FIREBASE_EVENTS.AUCTION_SOLD ||
        data.event === FIREBASE_EVENTS.AUCTION_CLOSED
      ) {
        if (data.endTime) setCurrentEndTime(data.endTime);
        if (data.status) setStatus(data.status);
      }
    }, (error) => {
      if (mounted) {
        console.error("[useAuctionBids] Subscription error:", error);
        setIsConnected(false);
      }
    });

    return () => {
      mounted = false;
      unsubConn();
      unsubBid();
    };
  }, [auctionId]);

  return { newBids, currentEndTime, isConnected, status };
}
