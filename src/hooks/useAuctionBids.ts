'use client';

import { useEffect, useState } from 'react';
import { onValue, onDisconnect, ref, set, remove } from 'firebase/database';
import { getClientDB, getClientAuth, ensureFirebaseAuth } from '@/lib/firebase-client';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';

export type RealTimeBid = {
  amount:     number;
  endTime:    Date | string;
  bidderName: string;
};

export function useAuctionBids(auctionId: string) {
  const [newBids,        setNewBids]        = useState<RealTimeBid[]>([]);
  const [currentEndTime, setCurrentEndTime] = useState<Date | string | null>(null);
  const [viewers,        setViewers]        = useState<number>(0);

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

    // Viewer presence — write our own presence node; remove on disconnect.
    // ensureFirebaseAuth() can resolve after unmount; bail out if so to avoid
    // writing a presence node we never clean up (and to skip onDisconnect on
    // a torn-down component).
    void (async () => {
      try {
        await ensureFirebaseAuth();
        if (!mounted) return;
        const auth   = getClientAuth();
        const uid    = auth.currentUser?.uid;
        if (!uid) return;

        const presenceRef = ref(db, RTDB_PATHS.presence(auctionId, uid));
        await set(presenceRef, { online: true, joinedAt: Date.now() });
        if (!mounted) {
          // Unmounted while writing — clean up immediately.
          remove(presenceRef).catch(() => {});
          return;
        }
        onDisconnect(presenceRef).remove();
      } catch {
        // Presence is optional — don't crash on auth failure
      }
    })();

    // Count viewers by watching the presence parent node
    const presenceParent = ref(db, RTDB_PATHS.presenceAuction(auctionId));
    const unsubPresence  = onValue(presenceParent, (snapshot) => {
      if (!mounted) return;
      setViewers(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });

    return () => {
      mounted = false;
      unsubBid();
      unsubPresence();

      // Remove own presence on unmount
      const auth = getClientAuth();
      const uid  = auth.currentUser?.uid;
      if (uid) {
        remove(ref(db, RTDB_PATHS.presence(auctionId, uid))).catch(() => {});
      }
    };
  }, [auctionId]);

  return { newBids, currentEndTime, viewers };
}
