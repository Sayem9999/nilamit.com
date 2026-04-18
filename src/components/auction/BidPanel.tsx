"use client";

import { useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { placeBid, executeBuyItNow } from "@/actions/bid";
import confetti from "canvas-confetti";
import { formatBDT } from "@/lib/format";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Shield,
  Clock,
  Users,
} from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { useSettings } from "@/context/SettingsContext";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import { useSound } from "@/hooks/useSound";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { VerificationGuard } from "../auth/VerificationGuard";

interface BidPanelProps {
  auctionId: string;
  currentPrice: number;
  minBidIncrement: number;
  endTime: Date | string;
  isExpired: boolean;
  sellerId: string;
  reservePrice?: number | null;
  buyItNowPrice?: number | null;
  onBidPlaced?: () => void;
}

export function BidPanel({
  auctionId,
  currentPrice,
  minBidIncrement,
  endTime,
  isExpired,
  sellerId,
  reservePrice,
  buyItNowPrice,
  onBidPlaced,
}: BidPanelProps) {
  const { data: session } = useSession();
  const { soundEffectsEnabled, toggleSoundEffects } = useSettings();
  const { play: playGavel } = useSound("/sounds/gavel.mp3");
  const t = useTranslations("BidPanel");
  const locale = useLocale();
  const [latestPrice, setLatestPrice] = useState(currentPrice);
  const [latestEndTime] = useState(new Date(endTime));
  const [bidAmount, setBidAmount] = useState(currentPrice + minBidIncrement);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
    antiSnipeTriggered?: boolean;
  } | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showMFSModal, setShowMFSModal] = useState(false);

  const { newBids, currentEndTime, viewers } = useAuctionBids(auctionId);

  // Sync real-time data from hook directly to display without setting state
  const displayPrice = newBids.length > 0 ? newBids[0].amount : latestPrice;
  const displayEndTime = currentEndTime
    ? new Date(currentEndTime)
    : latestEndTime;

  // Track new bids for sound effect using previous length
  useEffect(() => {
    if (newBids.length > 0) {
      playGavel();
    }
  }, [newBids.length, playGavel]);
  const minBid = displayPrice + minBidIncrement;
  const quickBids = [
    minBid,
    minBid + minBidIncrement * 2,
    minBid + minBidIncrement * 5,
  ];

  const handleBid = () => {
    if (!session) {
      if (typeof window !== "undefined") {
        window.location.href = `/${locale}/login`;
      }
      return;
    }

    startTransition(async () => {
      const res = await placeBid(auctionId, bidAmount);
      setResult(res);
      if (res.success) {
        // Sound Effect handled by setLatestPrice if we want it to triggers
        // or manually here for faster feedback
        playGavel();
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });

        // Price will update via next poll or immediately here for better UX
        const newPrice = bidAmount;
        setLatestPrice(newPrice);
        setBidAmount(newPrice + minBidIncrement);
        onBidPlaced?.();
      }
      if (res.error === "PHONE_NOT_VERIFIED") {
        setShowPhoneModal(true);
      }
      
      // Elite Auction Check: Trigger MFS Modal if linkage is missing for 100k+ bids
      if (res.error === "MFS_LINKAGE_REQUIRED" || res.error === "BID_DEPOSIT_REQUIRED_FOR_ELITE_AUCTION") {
        setShowMFSModal(true);
      }
    });
  };

  const handleBuyItNow = () => {
    if (!session) {
      if (typeof window !== "undefined") {
        window.location.href = `/${locale}/login`;
      }
      return;
    }

    if (
      !confirm(
        `Are you sure you want to buy this item now for ${formatBDT(buyItNowPrice as number)}?`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await executeBuyItNow(auctionId);
      setResult(res);
      if (res.success) {
        playGavel();
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899', '#22c55e']
        });
        onBidPlaced?.();
      }
    });
  };

  const isOwnAuction = session?.user?.id === sellerId;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" aria-hidden="true" />
          {t("placeBid")}
        </h3>
        <div className="flex items-center gap-2">
          {viewers > 0 && (
            <div
              className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-medium animate-pulse"
              title={`${viewers} person(s) currently viewing this auction`}
              aria-label={`${viewers} ${t("viewing", { fallback: "viewing" })}`}
            >
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span aria-hidden="true">{viewers} {t("viewing", { fallback: "viewing" })}</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleSoundEffects}
            aria-pressed={soundEffectsEnabled}
            aria-label={soundEffectsEnabled ? "Mute sound effects" : "Unmute sound effects"}
            className={`p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              soundEffectsEnabled
                ? "text-primary-600 bg-primary-50"
                : "text-gray-400 bg-gray-50"
            }`}
            title={soundEffectsEnabled ? "Mute" : "Unmute"}
          >
            {soundEffectsEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <CountdownTimer endTime={displayEndTime} />
          </div>
        </div>
      </div>

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
          {/* Current Price */}
          <div className="bg-primary-50 rounded-xl p-4 mb-4 transition-all duration-300">
            <p className="text-xs text-primary-600 font-medium mb-1">
              {t("currentPrice")}
            </p>
            <p className="price text-2xl text-primary-700">
              {formatBDT(displayPrice)}
            </p>
            {reservePrice && displayPrice < reservePrice && (
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter mt-1 bg-amber-50 px-2 py-0.5 rounded inline-block">
                Reserve not met
              </p>
            )}
            {reservePrice && displayPrice >= reservePrice && (
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-tighter mt-1 bg-green-50 px-2 py-0.5 rounded inline-block">
                Reserve met
              </p>
            )}
          </div>

          {/* Buy It Now option */}
          {buyItNowPrice && (
            <div className="mb-4">
              <VerificationGuard>
                <button
                  type="button"
                  onClick={handleBuyItNow}
                  disabled={isPending}
                  aria-busy={isPending}
                  aria-label={`Buy it now for ${formatBDT(buyItNowPrice as number)}`}
                  className="w-full group bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-0.5 overflow-hidden relative focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/30"
                >
                  <div className="flex items-center gap-2 relative z-10 text-sm">
                    <span>BUY IT NOW</span>
                    <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-ping" />
                  </div>
                  <div className="price text-lg relative z-10">
                    {formatBDT(buyItNowPrice)}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
              </VerificationGuard>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="h-px bg-gray-100 flex-1" />
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                  OR PLACE A BID
                </span>
                <div className="h-px bg-gray-100 flex-1" />
              </div>
            </div>
          )}

          {/* Bid Input */}
          <div className="mb-3">
            <label htmlFor="bid-amount" className="text-xs font-medium text-gray-500 mb-1 block">
              {t("yourBid")}
            </label>
            <input
              id="bid-amount"
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(Number(e.target.value))}
              min={minBid}
              step={minBidIncrement}
              aria-describedby="bid-amount-hint"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 price text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <p id="bid-amount-hint" className="text-xs text-gray-400 mt-1">
              {t("minimumBid")} {formatBDT(minBid)}
            </p>
          </div>

          {/* Quick Bid Buttons */}
          <div className="flex gap-2 mb-4" role="group" aria-label={t("yourBid")}>
            {quickBids.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setBidAmount(amount)}
                aria-pressed={bidAmount === amount}
                aria-label={`${t("bidBtnPrefix")} ${formatBDT(amount)}`}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  bidAmount === amount
                    ? "bg-primary-50 border-primary-200 text-primary-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {formatBDT(amount)}
              </button>
            ))}
          </div>

          {/* Submit */}
          <VerificationGuard>
            <button
              type="button"
              onClick={handleBid}
              disabled={isPending || bidAmount < minBid}
              aria-busy={isPending}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
            >
              {isPending ? (
                <>
                  <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" aria-hidden="true" />
                  <span className="sr-only">{t("bidBtnPrefix")} {formatBDT(bidAmount)}</span>
                </>
              ) : (
                <>
                  {t("bidBtnPrefix")} {formatBDT(bidAmount)}
                </>
              )}
            </button>
          </VerificationGuard>

          {/* Result */}
          {result && (
            <div
              role={result.success ? "status" : "alert"}
              aria-live={result.success ? "polite" : "assertive"}
              className={`mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${
                result.success
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {result.success ? (
                <>
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">{t("success")}</p>
                    {result.antiSnipeTriggered && (
                      <p className="text-xs mt-1 text-green-600">
                        {t("antiSnipe")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <p>
                    {result.error === "PHONE_NOT_VERIFIED"
                      ? t("phoneNotVerified")
                      : result.error}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Trust indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t("trustIndicator")}</span>
          </div>
        </>
      )}

      {showPhoneModal && (
        <PhoneVerificationPrompt onClose={() => setShowPhoneModal(false)} />
      )}

      {showMFSModal && (
        <MFSLinkagePrompt onClose={() => setShowMFSModal(false)} />
      )}
    </div>
  );
}

function PhoneVerificationPrompt({ onClose }: { onClose: () => void }) {
  const t = useTranslations("BidPanel");
  const locale = useLocale();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-verify-title"
      aria-describedby="phone-verify-desc"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 id="phone-verify-title" className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("verifyPhone")}
        </h3>
        <p id="phone-verify-desc" className="text-sm text-gray-500 mb-4">{t("verifyPhoneDesc")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {t("laterBtn")}
          </button>
          <Link
            href={`/${locale}/profile`}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
          >
            {t("verifyNowBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function MFSLinkagePrompt({ onClose }: { onClose: () => void }) {
  const t = useTranslations("BidPanel");
  const locale = useLocale();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfs-link-title"
      aria-describedby="mfs-link-desc"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 id="mfs-link-title" className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("mfsLinkRequired")}
        </h3>
        <p id="mfs-link-desc" className="text-sm text-gray-500 mb-4">{t("mfsLinkDesc")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {t("laterBtn")}
          </button>
          <Link
            href={`/${locale}/profile`}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30"
          >
            {t("linkMFSNowBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
