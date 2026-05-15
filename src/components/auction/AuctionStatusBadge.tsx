"use client";

import { useAuctionPrice } from "@/hooks/useAuctionPrice";
import { AuctionStatus } from "@/types";
import { useTranslations } from "next-intl";
import { CheckCircle } from "lucide-react";

export function AuctionStatusBadge({ 
  auctionId, 
  initialStatus, 
  initialPrice, 
  initialBidCount,
  endTime 
}: { 
  auctionId: string; 
  initialStatus: string; 
  initialPrice: number;
  initialBidCount: number;
  endTime: Date | string;
}) {
  const t = useTranslations("Auction");
  const { status } = useAuctionPrice(auctionId, initialPrice, initialBidCount, initialStatus);
  
  const now = new Date();
  const end = new Date(endTime);
  const isTimeEnded = now >= end;
  
  const displayStatus = (status === "ACTIVE" && isTimeEnded) ? "PROCESSING" : status;

  if (displayStatus === AuctionStatus.ACTIVE) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-md border border-green-100 text-xs font-semibold">
        <span className="relative flex w-2 h-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        {t("live")}
      </span>
    );
  }

  if (displayStatus === AuctionStatus.SOLD) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md border border-primary-100 text-xs font-semibold">
        <CheckCircle className="w-3.5 h-3.5" />
        {t("sold")}
      </span>
    );
  }

  if (displayStatus === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-100 text-xs font-semibold animate-pulse">
        {t("processing")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-700 rounded-md border border-gray-100 text-xs font-semibold">
      {t("ended")}
    </span>
  );
}
