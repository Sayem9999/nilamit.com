"use client";

import dynamic from "next/dynamic";
/**
 * Client-side wrapper for BidPanel to handle dynamic loading and SSR exclusion.
 */

interface BidPanelProps {
  auctionId: string;
  currentPrice: number;
  minBidIncrement: number;
  endTime: Date | string;
  serverTime?: Date | string;
  isExpired: boolean;
  sellerId: string;
  reservePrice?: number | null;
  buyItNowPrice?: number | null;
  proxyMaxBid?: number | null;
  proxyBidderId?: string | null;
  onBidPlaced?: () => void;
}

const BidPanel = dynamic(
  () => import("./BidPanel").then((mod) => mod.BidPanel),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-20 bg-primary-50 rounded-xl mb-4"></div>
        <div className="h-12 bg-gray-100 rounded-xl mb-4"></div>
        <div className="h-10 bg-gray-200 rounded-lg"></div>
      </div>
    ),
  },
);

export default function BidPanelWrapper(props: BidPanelProps) {
  return <BidPanel {...props} />;
}
