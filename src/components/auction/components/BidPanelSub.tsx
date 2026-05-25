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
      <div className="flex items-center gap-1.5 shrink-0">
        <ViewerCount auctionId={auctionId} />
        <button
          type="button"
          onClick={toggleSoundEffects}
          className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-colors shrink-0 ${
            soundEffectsEnabled 
              ? "text-primary-600 bg-primary-50 border-primary-100/50" 
              : "text-gray-400 bg-gray-50 border-gray-100"
          }`}
        >
          {soundEffectsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 px-3 h-8 rounded-xl shrink-0 select-none">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <CountdownTimer endTime={displayEndTime} serverTime={serverTime} className="font-mono text-xs" />
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
  bidCount: number;
  biddersCount: number;
}

export const BidPriceInfo = memo(function BidPriceInfo({
  t,
  displayPrice,
  startingPrice,
  reservePrice,
  proxyMaxBid,
  proxyBidderId,
  currentUserId,
  auctionId,
  bidCount,
  biddersCount
}: PriceInfoProps) {
  return (
    <>
      <div className="bg-primary-50 rounded-xl p-4 mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-xs text-primary-600 font-medium">{t("currentPrice")}</p>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight flex items-center gap-1.5 bg-white/60 px-2 py-0.5 rounded-full border border-primary-100/50 shadow-sm select-none">
            <span>{bidCount} {bidCount === 1 ? 'Bid' : 'Bids'}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full" />
            <span>{biddersCount} {biddersCount === 1 ? 'Bidder' : 'Bidders'}</span>
          </div>
        </div>
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
