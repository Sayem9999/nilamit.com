"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Gavel, TrendingUp, Clock } from "lucide-react";

interface Bid {
  id: string;
  amount: number;
  createdAt: string;
  bidder: { name: string | null; id: string };
}

interface BidHistoryProps {
  auctionId: string;
  initialBids?: Bid[];
}

export function BidHistory({ initialBids = [] }: BidHistoryProps) {
  const [bids] = useState<Bid[]>(initialBids);
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? bids : bids.slice(0, 5);

  if (bids.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
        <Gavel className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No bids yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="font-heading font-semibold text-gray-900 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" /> Bid History
        </h3>
        <span className="text-xs text-gray-400 font-medium">
          {bids.length} bids
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {displayed.map((bid, i) => (
          <div
            key={bid.id}
            className={`px-5 py-3 flex items-center justify-between ${i === 0 ? "bg-indigo-50/50" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {bid.bidder.name || "Anonymous"}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(bid.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            <p
              className={`font-bold text-sm ${i === 0 ? "text-indigo-600" : "text-gray-700"}`}
            >
              ৳{bid.amount.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {bids.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-gray-50"
        >
          {showAll ? "Show less" : `Show all ${bids.length} bids`}
        </button>
      )}
    </div>
  );
}
