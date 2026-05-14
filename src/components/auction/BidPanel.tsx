"use client";

import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { placeBid, executeBuyItNow } from "@/actions/bid";
import { formatBDT } from "@/lib/format";

// Lazy-load confetti so it doesn't ship in the initial bundle of every auction page.
type ConfettiOpts = {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
};
async function fireConfetti(opts: ConfettiOpts) {
  try {
    const mod = await import("canvas-confetti");
    (mod.default as (o: ConfettiOpts) => void)(opts);
  } catch {
    /* non-critical */
  }
}
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Shield,
  Clock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { useSettings } from "@/context/SettingsContext";
import { useAuctionBids, type RealTimeBid } from "@/hooks/useAuctionBids";
import { useSound } from "@/hooks/useSound";
import { useTranslations } from "next-intl";
import { ERROR_CODES } from "@/lib/constants";
import { ErrorType, type ServiceResponse } from "@/lib/errors";
import type { PlaceBidResult } from "@/types";
import { VerificationGuard } from "../auth/VerificationGuard";
import dynamic from "next/dynamic";
const MFSLinkagePrompt = dynamic(() => import("./components/BidPrompts").then(mod => mod.MFSLinkagePrompt), { ssr: false });
const EliteBarrierPrompt = dynamic(() => import("./components/BidPrompts").then(mod => mod.EliteBarrierPrompt), { ssr: false });
import { ViewerCount } from "./ViewerCount";
import PriceAlertButton from "./PriceAlertButton";

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
  initialBids?: RealTimeBid[];
  onBidPlaced?: () => void;
  startingPrice?: number;
}

export function BidPanel({
  auctionId,
  currentPrice,
  minBidIncrement,
  endTime,
  serverTime,
  isExpired,
  sellerId,
  reservePrice,
  buyItNowPrice,
  proxyMaxBid,
  proxyBidderId,
  initialBids,
  onBidPlaced,
  startingPrice,
}: BidPanelProps) {
  const { data: session } = useSession();
  const { soundEffectsEnabled, toggleSoundEffects } = useSettings();
  const { play: playGavel } = useSound("/sounds/gavel.mp3");
  const t = useTranslations("BidPanel");
  const { newBids, currentEndTime, isConnected } = useAuctionBids(auctionId, { initialBids });
  const [optimisticBid, setOptimisticBid] = useState<number | null>(null);

  const displayPrice = optimisticBid ?? (newBids.length > 0 ? newBids[0].amount : currentPrice);
  const displayEndTime = currentEndTime ? new Date(currentEndTime) : new Date(endTime);

  const minBid = displayPrice + minBidIncrement;

  // Track whether the user has manually edited the input. Without this we'd
  // overwrite their custom amount whenever it happens to equal the previous
  // minimum after a competing bid lands.
  const userTouchedRef = useRef(false);
  const [bidAmount, setBidAmount] = useState(minBid);
  useEffect(() => {
    // Bump the input to the new minimum if (a) it's now invalid, or
    // (b) the user hasn't typed anything custom yet.
    if (bidAmount < minBid || !userTouchedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBidAmount(minBid);
    }
  }, [minBid, bidAmount]);

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ServiceResponse<PlaceBidResult | null> | null>(null);
  const [showMFSModal, setShowMFSModal] = useState(false);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [showBinConfirm, setShowBinConfirm] = useState(false);

  // Track previous bid count via ref so we only fire the gavel on an actual
  // increase. Depending on `playGavel` would re-fire whenever useSound returns
  // a fresh function reference, double-playing on unrelated re-renders.
  const prevBidCountRef = useRef(newBids.length);
  useEffect(() => {
    if (newBids.length > prevBidCountRef.current) {
      playGavel();
      // If a real bid came in that matches or exceeds our optimistic bid, clear it
      if (optimisticBid && newBids[0]?.amount >= optimisticBid) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOptimisticBid(null);
      }
    }
    prevBidCountRef.current = newBids.length;
  }, [newBids, playGavel, optimisticBid]);


  const quickBids = useMemo(() => [
    minBid,
    minBid + minBidIncrement * 2,
    minBid + minBidIncrement * 5,
  ], [minBid, minBidIncrement]);

  const handleBid = useCallback(() => {
    if (isPending) return;
    if (!session) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return;
    }
    
    if (bidAmount < minBid) {
      setResult({
        success: false,
        error: {
          type: ErrorType.CONFLICT,
          message: `Bid must be at least ৳${minBid.toLocaleString()}`,
          code: ERROR_CODES.BID_TOO_LOW,
        }
      });
      return;
    }

    setOptimisticBid(bidAmount);
    playGavel();

    startTransition(async () => {
      const res = await placeBid(auctionId, bidAmount);
      setResult(res);

      if (res.success) {
        fireConfetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });

        userTouchedRef.current = false;
        setBidAmount(bidAmount + minBidIncrement);
        onBidPlaced?.();
      } else {
        setOptimisticBid(null);
        
        const newMin = (res.error?.details as { newMinimum?: number } | undefined)?.newMinimum;
        if (res.error?.code === ERROR_CODES.BID_TOO_LOW && newMin) {
          userTouchedRef.current = false;
          setBidAmount(newMin);
        }
        
        if (res.error?.code === "MFS_LINKAGE_REQUIRED") {
          setShowMFSModal(true);
        }

        if (res.error?.code === ERROR_CODES.ELITE_DEPOSIT_REQUIRED) {
          setShowEliteModal(true);
        }
      }
    });
  }, [isPending, session, bidAmount, minBid, playGavel, auctionId, minBidIncrement, onBidPlaced]);

  const openBuyItNow = useCallback(() => {
    if (isPending) return;
    if (!session) {
      if (typeof window !== "undefined") window.location.href = "/login";
      return;
    }
    setShowBinConfirm(true);
  }, [isPending, session]);

  const confirmBuyItNow = useCallback(() => {
    setShowBinConfirm(false);
    startTransition(async () => {
      const res = await executeBuyItNow(auctionId);
      setResult(res);
      if (res.success) {
        playGavel();
        fireConfetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899', '#22c55e']
        });
        onBidPlaced?.();
      }
    });
  }, [auctionId, playGavel, onBidPlaced]);

  const isOwnAuction = useMemo(() => session?.user?.id === sellerId, [session?.user?.id, sellerId]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
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
            aria-label={soundEffectsEnabled ? "Mute bid sound effects" : "Unmute bid sound effects"}
            aria-pressed={soundEffectsEnabled}
            className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              soundEffectsEnabled ? "text-primary-600 bg-primary-50" : "text-gray-400 bg-gray-50"
            }`}
          >
            {soundEffectsEnabled ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <CountdownTimer endTime={displayEndTime} serverTime={serverTime} />
        </div>
      </div>
    </div>
      
      {!isConnected && (
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3 animate-pulse">
          <div className="w-2 h-2 bg-amber-400 rounded-full" />
          <p className="text-xs text-amber-700 font-medium">
            Live connection lost. Attempting to reconnect...
          </p>
        </div>
      )}

      {isExpired ? (
        <div className="text-center py-6">
          <p className="text-gray-500 font-medium">{t("auctionEnded")}</p>
        </div>
      ) : isOwnAuction ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl">
          <p className="text-gray-500 text-sm">{t("cannotBidOwn")}</p>
        </div>
      ) : (
        <>
          <div className="bg-primary-50 rounded-xl p-4 mb-4 transition-all duration-300">
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
            {proxyMaxBid && proxyBidderId === session?.user?.id && (
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

          {buyItNowPrice && (
            <div className="mb-4">
              <VerificationGuard>
                <button
                  type="button"
                  onClick={openBuyItNow}
                  disabled={isPending}
                  aria-label={`Buy it now for ${formatBDT(buyItNowPrice)}`}
                  className="w-full group bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-0.5 overflow-hidden relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2 relative z-10 text-sm">
                    <span>BUY IT NOW</span>
                    <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-ping" aria-hidden="true" />
                  </div>
                  <div className="price text-lg relative z-10">{formatBDT(buyItNowPrice)}</div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" aria-hidden="true" />
                </button>
              </VerificationGuard>
            </div>
          )}

          <div className="mb-3">
            <label htmlFor="bid-amount-input" className="text-xs font-medium text-gray-500 mb-1 block">{t("yourBid")}</label>
            <input
              id="bid-amount-input"
              type="number"
              value={bidAmount}
              onChange={(e) => { userTouchedRef.current = true; setBidAmount(Number(e.target.value)); }}
              min={minBid}
              step={minBidIncrement}
              aria-describedby="bid-amount-hint"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 price text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <p id="bid-amount-hint" className="text-xs text-gray-400 mt-1">{t("minimumBid")} {formatBDT(minBid)}</p>
          </div>

          <div className="flex gap-2 mb-4" role="group" aria-label="Quick bid amounts">
            {quickBids.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => { userTouchedRef.current = true; setBidAmount(amount); }}
                aria-pressed={bidAmount === amount}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  bidAmount === amount ? "bg-primary-50 border-primary-200 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {formatBDT(amount)}
              </button>
            ))}
          </div>

          <VerificationGuard>
            <button
              type="button"
              onClick={handleBid}
              disabled={isPending || bidAmount < minBid}
              aria-label={`${t("bidBtnPrefix")} ${formatBDT(bidAmount)}`}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
            >
              {isPending ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" aria-hidden="true" />
              ) : (
                <>{t("bidBtnPrefix")} {formatBDT(bidAmount)}</>
              )}
            </button>
          </VerificationGuard>

          {/* aria-live polite — announces success / failure to screen readers without
              stealing focus. role=status keeps the announcement tone advisory. */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {result?.success ? t("success") : (result?.error?.message ?? "")}
          </div>

          {result && (
            <div className={`mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${
              result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}>
              {result.success
                ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />}
              <div>
                <p className="font-medium">{result.success ? t("success") : (result.error?.message)}</p>
                {result.success && result.data?.antiSnipeTriggered && <p className="text-xs mt-1 text-green-600">{t("antiSnipe")}</p>}
              </div>
            </div>
          )}

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
      )}

      {showMFSModal && <MFSLinkagePrompt onClose={() => setShowMFSModal(false)} />}
      {showEliteModal && (
        <EliteBarrierPrompt
          onClose={() => setShowEliteModal(false)}
          auctionId={auctionId}
          amount={Number(bidAmount)}
        />
      )}

      {showBinConfirm && buyItNowPrice && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowBinConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-heading font-bold text-gray-900 mb-1">
              Confirm Buy It Now
            </h2>
            <p className="text-sm text-gray-600 mb-2">
              You are about to purchase this item instantly for:
            </p>
            <p className="price text-2xl text-primary-700 mb-4">
              {formatBDT(buyItNowPrice as number)}
            </p>
            <p className="text-xs text-gray-500 mb-5">
              This is a binding purchase. After confirmation an escrow transaction
              is created and you&apos;ll be guided to pay the advance fee.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBinConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBuyItNow}
                disabled={isPending}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm bg-accent-600 hover:bg-accent-700 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Confirm Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
