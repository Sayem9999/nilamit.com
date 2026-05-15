"use client";

import { memo } from "react";
import { TrendingUp, Volume2, VolumeX, Shield, Clock } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { CountdownTimer } from "../CountdownTimer";
import { ViewerCount } from "../ViewerCount";
import PriceAlertButton from "../PriceAlertButton";

interface HeaderProps {
  auctionId: string;
  t: (key: string) => string;
  soundEffectsEnabled: boolean;
  toggleSoundEffects: () => void;
  displayEndTime: Date;
  serverTime?: Date | string;
}

export const BidPanelHeader = memo(function BidPanelHeader({
  auctionId,
  t,
  soundEffectsEnabled,
  toggleSoundEffects,
  displayEndTime,
  serverTime
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary-600" aria-hidden="true" />
        {t("placeBid")}
      </h3>
      <div className="flex items-center gap-2">
        <ViewerCount auctionId={auctionId} />
        <button
          type="button"
          onClick={toggleSoundEffects}
          className={`p-1.5 rounded-lg transition-colors ${
            soundEffectsEnabled ? "text-primary-600 bg-primary-50" : "text-gray-400 bg-gray-50"
          }`}
        >
          {soundEffectsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
          <Clock className="w-4 h-4" />
          <CountdownTimer endTime={displayEndTime} serverTime={serverTime} />
        </div>
      </div>
    </div>
  );
});

interface PriceInfoProps {
  t: (key: string) => string;
  displayPrice: number;
  startingPrice?: number;
  reservePrice?: number | null;
  proxyMaxBid?: number | null;
  proxyBidderId?: string | null;
  currentUserId?: string;
  auctionId: string;
}

export const BidPriceInfo = memo(function BidPriceInfo({
  t,
  displayPrice,
  startingPrice,
  reservePrice,
  proxyMaxBid,
  proxyBidderId,
  currentUserId,
  auctionId
}: PriceInfoProps) {
  return (
    <>
      <div className="bg-primary-50 rounded-xl p-4 mb-4">
        <p className="text-xs text-primary-600 font-medium mb-1">{t("currentPrice")}</p>
        <p className="price text-2xl text-primary-700">{formatBDT(displayPrice)}</p>
        {startingPrice && (
          <p className="text-xs text-gray-400 mt-1">
            {t("startingPrice")}: {formatBDT(startingPrice)}
          </p>
        )}
        {reservePrice && (
          <p className={`text-[10px] font-bold uppercase tracking-tighter mt-1 px-2 py-0.5 rounded inline-block ${
            displayPrice < reservePrice ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50"
          }`}>
            {displayPrice < reservePrice ? "Reserve not met" : "Reserve met"}
          </p>
        )}
        {proxyMaxBid && proxyBidderId === currentUserId && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight flex items-center gap-1">
              <Shield className="w-3 h-3" /> You are the high bidder
            </p>
            <p className="text-xs text-blue-700 font-medium">
              Your max bid: <span className="font-bold">{formatBDT(proxyMaxBid)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100/80 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5" />
          <span>{t("trustIndicator")}</span>
        </div>
        <PriceAlertButton
          auctionId={auctionId}
          currentPrice={displayPrice}
        />
      </div>
    </>
  );
});
