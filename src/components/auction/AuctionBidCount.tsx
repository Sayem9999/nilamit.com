"use client";

import { useAuctionPrice } from "@/hooks/useAuctionPrice";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

export function AuctionBidCount({ 
  auctionId, 
  initialBidCount,
  initialPrice,
  initialStatus
}: { 
  auctionId: string; 
  initialBidCount: number;
  initialPrice: number;
  initialStatus: string;
}) {
  const t = useTranslations("Auction");
  const { bidCount } = useAuctionPrice(auctionId, initialPrice, initialBidCount, initialStatus);

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
      <Users className="w-3.5 h-3.5" />
      {bidCount || 0} {t("bids")}
    </div>
  );
}
