"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { onChildAdded, ref, query, limitToLast } from "firebase/database";
import { getClientDB } from "@/lib/firebase-client";
import { RTDB_PATHS } from "@/lib/firebase-events";

import { LatestActivity } from "@/types";

interface LiveTickerProps {
  initialActivity: LatestActivity[];
}

export function LiveTicker({ initialActivity }: LiveTickerProps) {
  const [activities, setActivities] = useState<LatestActivity[]>(initialActivity);

  useEffect(() => {
    const db         = getClientDB();
    const globalRef  = query(
      ref(db, RTDB_PATHS.globalActivity()),
      limitToLast(20)            // Only tail the last 20 events
    );

    const startTime = Date.now();

    const unsub = onChildAdded(globalRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.auctionId || (data._ts && data._ts < startTime)) return;

      const newActivity: LatestActivity = {
        // Stable id — a random fallback would change every render and force
        // React to remount the row, dropping the ticker animation (audit M5).
        id:        snapshot.key ?? `evt-${data._ts ?? Date.now()}`,
        amount:    data.amount,
        createdAt: new Date(data._ts ?? Date.now()),
        bidder:    { name: data.bidder ?? 'Someone' },
        auction:   { id: data.auctionId, title: data.auctionTitle ?? '' },
      };

      setActivities(prev => [newActivity, ...prev].slice(0, 10));
    });

    return () => unsub();
  }, []);

  if (activities.length === 0) return null;

  return (
    <aside aria-label="Live activity ticker" className="bg-gray-900 overflow-hidden py-2 block">
      <div className="flex animate-marquee motion-reduce:animate-none whitespace-nowrap">
        {[...activities, ...activities].map((activity, i) => (
          <div key={i} className="flex items-center gap-2 mx-8 text-[11px] font-bold text-gray-400">
            <span className="relative flex w-2 h-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-white">{activity.bidder.name}</span>
            <span>bid ৳{activity.amount.toLocaleString()} on</span>
            <Link href={`/auctions/${activity.auction.id}`} className="text-primary-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded">
              {activity.auction.title}
            </Link>
            <Clock className="w-3 h-3 ml-1" aria-hidden="true" />
            <span>
              {new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
