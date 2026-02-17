"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { pusherClient } from "@/lib/pusher-client";

export interface LatestActivity {
  id: string;
  amount: number;
  createdAt: Date;
  bidder: { name: string | null };
  auction: { id: string; title: string };
}

interface LiveTickerProps {
  initialActivity: LatestActivity[];
}

export function LiveTicker({ initialActivity }: LiveTickerProps) {
  const [activities, setActivities] =
    useState<LatestActivity[]>(initialActivity);

  useEffect(() => {
    const channel = pusherClient.subscribe("global-ticker");

    channel.bind(
      "new-activity",
      (data: {
        amount: number;
        bidder: string;
        auctionId: string;
        auctionTitle: string;
      }) => {
        const newActivity: LatestActivity = {
          id: Math.random().toString(),
          amount: data.amount,
          createdAt: new Date(),
          bidder: { name: data.bidder },
          auction: { id: data.auctionId, title: data.auctionTitle },
        };

        setActivities((prev) => [newActivity, ...prev].slice(0, 10));
      },
    );

    return () => {
      pusherClient.unsubscribe("global-ticker");
    };
  }, []);

  if (activities.length === 0) return null;

  return (
    <div className="bg-gray-900 overflow-hidden py-2 block">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...activities, ...activities].map((activity, i) => (
          <div
            key={i}
            className="flex items-center gap-2 mx-8 text-[11px] font-bold text-gray-400"
          >
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white">{activity.bidder.name}</span>
            <span>bid ৳{activity.amount.toLocaleString()} on</span>
            <Link
              href={`/auctions/${activity.auction.id}`}
              className="text-primary-400 hover:underline"
            >
              {activity.auction.title}
            </Link>
            <Clock className="w-3 h-3 ml-1" />
            <span>
              {new Date(activity.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
