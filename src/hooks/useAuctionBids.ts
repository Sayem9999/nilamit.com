'use client';

import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getClientDB } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { RealTimeBid } from '@/types';


export interface UseAuctionBidsOptions {
  /**
   * Server-rendered initial bids — populates the live list before the first
   * RTDB event arrives, so a page refresh on a busy auction doesn't show an
   * empty "live" panel until the next bid lands.
   */
  initialBids?: RealTimeBid[];
  initialStatus?: string;
}

export function useAuctionBids(auctionId: string, options: UseAuctionBidsOptions = {}) {
  const [newBids,        setNewBids]        = useState<RealTimeBid[]>(options.initialBids ?? []);
  const [currentEndTime, setCurrentEndTime] = useState<Date | string | null>(null);
  const [status,         setStatus]         = useState<string | null>(options.initialStatus ?? null);
  const [isConnected,    setIsConnected]    = useState(true);

  useEffect(() => {
    let mounted = true;
    const db = getClientDB();
    let connTimeout: NodeJS.Timeout | null = null;

    const connectedRef = ref(db, ".info/connected");
    const unsubConn = onValue(connectedRef, (snap) => {
      if (!mounted) return;
      const val = !!snap.val();
      if (val) {
        if (connTimeout) {
          clearTimeout(connTimeout);
          connTimeout = null;
        }
        setIsConnected(true);
      } else {
        if (!connTimeout) {
          connTimeout = setTimeout(() => {
            if (mounted) setIsConnected(false);
          }, 4000);
        }
      }
    });

    const bidRef = ref(db, RTDB_PATHS.auctionBid(auctionId));
    const unsubBid = onValue(bidRef, (snapshot) => {
      if (!mounted) return;
      const data = snapshot.val();
      if (!data) return;

      const eventType = data.type || data.event;
      if (eventType === FIREBASE_EVENTS.NEW_BID) {
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
      }
    }, (error) => {
      if (mounted) {
        console.error("[useAuctionBids] Subscription error:", error);
        setIsConnected(false);
      }
    });

    const statusRef = ref(db, RTDB_PATHS.auctionStatus(auctionId));
    const unsubStatus = onValue(statusRef, (snapshot) => {
      if (!mounted) return;
      const data = snapshot.val();
      if (!data) return;

      const eventType = data.type || data.event;
      if (eventType === FIREBASE_EVENTS.AUCTION_SOLD || eventType === FIREBASE_EVENTS.AUCTION_CLOSED) {
        if (data.endTime) setCurrentEndTime(data.endTime);
        if (data.status) setStatus(data.status);
      }
    });

    return () => {
      mounted = false;
      if (connTimeout) clearTimeout(connTimeout);
      unsubConn();
      unsubBid();
      unsubStatus();
    };
  }, [auctionId]);

  return { newBids, currentEndTime, isConnected, status };
}
