"use client";

import { useState, useTransition, useEffect, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { placeBid, executeBuyItNow } from "@/actions/bid";
import { formatBDT } from "@/lib/format";
import { ErrorType, ServiceResponse } from "@/lib/errors";
import { ERROR_CODES } from "@/lib/constants";
import { PlaceBidResult, RealTimeBid } from "@/types";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import { useAuctionPrice } from "@/hooks/useAuctionPrice";
import { useSound } from "@/hooks/useSound";
import { useSettings } from "@/context/SettingsContext";
import { VerificationGuard } from "@/components/auth/VerificationGuard";
import { BidPanelHeader, BidPriceInfo } from "./components/BidPanelSub";
import { MFSLinkagePrompt, EliteBarrierPrompt } from "./components/BidPrompts";
import toast from "react-hot-toast";

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

interface BidPanelProps {
  auctionId: string;
  currentPrice: number;
  minBidIncrement: number;
  endTime: Date | string;
  serverTime?: Date | string;
  isExpired?: boolean;
  sellerId: string;
  reservePrice?: number | null;
  buyItNowPrice?: number | null;
  proxyMaxBid?: number | null;
  proxyBidderId?: string | null;
  initialBids?: RealTimeBid[];
  onBidPlaced?: () => void;
  startingPrice?: number;
  initialStatus?: string;
  initialBidCount?: number;
  initialBiddersCount?: number;
}

export function BidPanel({
  auctionId,
  currentPrice,
  minBidIncrement,
  endTime,
  serverTime,
  sellerId,
  reservePrice,
  buyItNowPrice,
  proxyMaxBid,
  proxyBidderId,
  initialBids,
  onBidPlaced,
  startingPrice,
  initialStatus,
  initialBidCount = 0,
  initialBiddersCount = 0,
}: BidPanelProps) {
  const { data: session } = useSession();
  const { soundEffectsEnabled, toggleSoundEffects } = useSettings();
  const { play: playGavel } = useSound("/sounds/gavel.mp3");
  const t = useTranslations("BidPanel");
  const { newBids, currentEndTime, isConnected, status: rtStatus } = useAuctionBids(auctionId, { initialBids, initialStatus });
  const { bidCount: rtBidCount } = useAuctionPrice(auctionId, currentPrice, initialBidCount, initialStatus);
  
  const [knownBidderIds, setKnownBidderIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    initialBids?.forEach(b => { if (b.bidderId) ids.add(b.bidderId); });
    return ids;
  });

  useEffect(() => {
    if (newBids.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKnownBidderIds(prev => {
        const next = new Set(prev);
        newBids.forEach(b => { if (b.bidderId) next.add(b.bidderId); });
        return next;
      });
    }
  }, [newBids]);

  const currentStatus = rtStatus || initialStatus || "ACTIVE"; 
  const [optimisticBid, setOptimisticBid] = useState<number | null>(null);
  const [liveBidAlert, setLiveBidAlert] = useState<{ amount: number; bidderName: string; isAntiSnipe: boolean } | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (liveBidAlert) {
      timer = setTimeout(() => {
        setLiveBidAlert(null);
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [liveBidAlert]);

  const displayPrice = useMemo(() => 
    optimisticBid ?? (newBids.length > 0 ? newBids[0].amount : currentPrice),
  [optimisticBid, newBids, currentPrice]);

  const displayEndTime = useMemo(() => 
    currentEndTime ? new Date(currentEndTime) : new Date(endTime),
  [currentEndTime, endTime]);

  const now = new Date();
  const isTimeEnded = now >= displayEndTime;
  const isProcessing = currentStatus === "ACTIVE" && isTimeEnded;
  const isActuallyExpired = isTimeEnded || currentStatus === "SOLD" || currentStatus === "EXPIRED";

  const minBid = displayPrice + minBidIncrement;

  const userTouchedRef = useRef(false);
  const [bidAmount, setBidAmount] = useState(minBid);

  useEffect(() => {
    if (bidAmount < minBid || !userTouchedRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBidAmount(minBid);
    }
  }, [minBid, bidAmount]); // Only reset on minBid change

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ServiceResponse<PlaceBidResult | null> | null>(null);
  const [showMFSModal, setShowMFSModal] = useState(false);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [showBinConfirm, setShowBinConfirm] = useState(false);

  const prevTopBidRef = useRef(newBids[0]?.id);
  useEffect(() => {
    const currentTopBid = newBids[0];
    const previousTopBidId = prevTopBidRef.current;
    
    if (currentTopBid && currentTopBid.id !== previousTopBidId) {
      playGavel();
      if (optimisticBid && currentTopBid.amount >= optimisticBid) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOptimisticBid(null);
      }

      // Visual Live Bid Alert Banner
      if (previousTopBidId && currentTopBid.bidderId !== session?.user?.id) {
        const isAntiSnipe = currentEndTime ? (new Date(currentEndTime).getTime() > new Date(endTime).getTime()) : false;
        setLiveBidAlert({
          amount: currentTopBid.amount,
          bidderName: currentTopBid.bidderName ?? 'Someone',
          isAntiSnipe,
        });
      }

      // Live Outbid Notification Logic
      if (session?.user?.id && previousTopBidId) {
        const previousBid = newBids.find(b => b.id === previousTopBidId) || 
                            initialBids?.find(b => b.id === previousTopBidId);
        
        const wasUserTop = previousBid?.bidderId === session.user.id;
        const isNewBidderOthers = currentTopBid.bidderId !== session.user.id;
        
        if (wasUserTop && isNewBidderOthers) {
          toast.error(`⚠️ Outbid! Someone placed a higher bid of ${formatBDT(currentTopBid.amount)}. Bid again now!`, {
            duration: 8000,
            position: "top-center",
            style: {
              background: "#dc2626",
              color: "#ffffff",
              fontWeight: "900",
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.025em",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -5px rgba(220,38,38,0.25)",
              border: "1px solid rgba(255,255,255,0.15)",
            }
          });
        }
      }
    }
    prevTopBidRef.current = currentTopBid?.id;
  }, [newBids, playGavel, optimisticBid, session, initialBids, currentEndTime, endTime]);

  const quickBids = useMemo(() => [
    minBid,
    minBid + minBidIncrement * 2,
    minBid + minBidIncrement * 5,
  ], [minBid, minBidIncrement]);

  const handleBid = useCallback(() => {
    if (isPending) return;
    if (!session) {
      if (typeof window !== "undefined") window.location.href = "/login";
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
      setResult(res as ServiceResponse<PlaceBidResult | null>);

      if (res.success) {
        const data = res.data as PlaceBidResult;
        setOptimisticBid(data.newCurrentPrice ?? null);
        fireConfetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });

        userTouchedRef.current = false;
        setBidAmount((data.newCurrentPrice ?? bidAmount) + minBidIncrement);
        onBidPlaced?.();
      } else {
        setOptimisticBid(null);
        const newMin = (res.error?.details as { newMinimum?: number } | undefined)?.newMinimum;
        if (res.error?.code === ERROR_CODES.BID_TOO_LOW && newMin) {
          userTouchedRef.current = false;
          setBidAmount(newMin);
        }
        if (res.error?.code === ERROR_CODES.MFS_LINKAGE_REQUIRED) setShowMFSModal(true);
        if (res.error?.code === ERROR_CODES.ELITE_DEPOSIT_REQUIRED) setShowEliteModal(true);
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
      setResult(res as ServiceResponse<PlaceBidResult | null>);
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
    <div className="bg-white rounded-md border border-gray-100 shadow-sm p-6">
      <BidPanelHeader 
        auctionId={auctionId}
        t={t}
        soundEffectsEnabled={soundEffectsEnabled}
        toggleSoundEffects={toggleSoundEffects}
        displayEndTime={displayEndTime}
        serverTime={serverTime}
      />
      
      <AnimatePresence>
        {liveBidAlert && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", y: 0, marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, y: -10, marginBottom: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="overflow-hidden"
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes shrink {
                from { width: 100%; }
                to { width: 0%; }
              }
              .animate-shrink-bar {
                animation: shrink 5s linear forwards;
              }
            `}} />
            <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 text-white rounded-xl p-4 shadow-lg border border-white/10 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-end pr-4 pointer-events-none select-none">
                <span className="text-7xl font-bold italic">BID</span>
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/25 backdrop-blur-sm animate-pulse">
                  <span className="text-sm">⚡</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wide text-primary-200">Live Bid Alert</span>
                    {liveBidAlert.isAntiSnipe && (
                      <span className="text-[10px] bg-emerald-500/90 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-bounce">
                        Anti-Snipe Extended
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white mt-0.5">
                    <span className="font-bold text-yellow-300">{liveBidAlert.bidderName}</span> placed <span className="font-extrabold text-white text-sm">{formatBDT(liveBidAlert.amount)}</span>!
                  </p>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 h-[3px] bg-white/30 animate-shrink-bar" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isConnected && (
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3 animate-pulse">
          <div className="w-2 h-2 bg-amber-400 rounded-full" />
          <p className="text-xs text-amber-700 font-medium">Live connection lost. Reconnecting...</p>
        </div>
      )}

      {isActuallyExpired ? (
        <div className="text-center py-6">
          <p className="text-gray-900 font-bold text-lg mb-1">
            {currentStatus === "SOLD" ? t("auctionSold") : t("auctionEnded")}
          </p>
          {isProcessing && <p className="text-amber-600 text-xs font-semibold animate-pulse uppercase tracking-wider">{t("processingResult")}</p>}
        </div>
      ) : isOwnAuction ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl">
          <p className="text-gray-500 text-sm">{t("cannotBidOwn")}</p>
        </div>
      ) : (
        <>
          <BidPriceInfo 
            t={t}
            displayPrice={displayPrice}
            startingPrice={startingPrice}
            reservePrice={reservePrice}
            proxyMaxBid={proxyMaxBid}
            proxyBidderId={proxyBidderId}
            currentUserId={session?.user?.id}
            auctionId={auctionId}
            bidCount={rtBidCount}
            biddersCount={Math.max(initialBiddersCount, knownBidderIds.size)}
          />

          {buyItNowPrice && (
            <div className="mt-4 mb-4">
              <VerificationGuard>
                <motion.button
                  type="button"
                  onClick={openBuyItNow}
                  disabled={isPending}
                  whileHover={isPending ? {} : { scale: 1.02 }}
                  whileTap={isPending ? {} : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="w-full group bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
                >
                  <div className="flex items-center gap-2 relative z-10 text-sm">
                    <span>BUY IT NOW</span>
                    <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-ping" />
                  </div>
                  <div className="price text-lg relative z-10">{formatBDT(buyItNowPrice)}</div>
                </motion.button>
              </VerificationGuard>
            </div>
          )}

          <div className="mb-3">
            <label htmlFor="bid-amount-input" className="text-xs font-medium text-gray-500 mb-1 block">
              {t("yourBid")}
              <span className="ml-1 text-[10px] font-bold text-primary-600 uppercase tracking-wide">
                · {t("maxProxyHint")}
              </span>
            </label>
            <input
              id="bid-amount-input"
              type="number"
              value={bidAmount}
              onChange={(e) => { userTouchedRef.current = true; setBidAmount(Number(e.target.value)); }}
              min={minBid}
              step={minBidIncrement}
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-4 py-3 price text-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {t("minimumBid")} {formatBDT(minBid)} · <span className="text-gray-600">{t("proxyExplain")}</span>
            </p>
          </div>

          <div className="flex gap-2 mb-4">
            {quickBids.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => { userTouchedRef.current = true; setBidAmount(amount); }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  bidAmount === amount ? "bg-primary-50 border-primary-200 text-primary-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {formatBDT(amount)}
              </button>
            ))}
          </div>

          <VerificationGuard>
            <motion.button
              type="button"
              onClick={handleBid}
              disabled={isPending || bidAmount < minBid}
              whileHover={isPending || bidAmount < minBid ? {} : { scale: 1.02 }}
              whileTap={isPending || bidAmount < minBid ? {} : { scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <>{t("bidBtnPrefix")} {formatBDT(bidAmount)}</>}
            </motion.button>
          </VerificationGuard>

          <div role="status" aria-live="polite" className="sr-only">
            {result?.success ? t("success") : (result?.error?.message ?? "")}
          </div>

          {result && (
            <div className={`mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {result.success ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
              <div>
                <p className="font-medium">{result.success ? t("success") : (result.error?.message)}</p>
                {result.success && (result.data as PlaceBidResult)?.antiSnipeTriggered && <p className="text-xs mt-1 text-green-600">{t("antiSnipe")}</p>}
              </div>
            </div>
          )}
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowBinConfirm(false)}>
          <div className="bg-white rounded-md shadow-md max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-heading font-bold text-gray-900 mb-1">Confirm Buy It Now</h2>
            <p className="text-sm text-gray-600 mb-2">You are about to purchase this item instantly for:</p>
            <p className="price text-2xl text-primary-700 mb-4">{formatBDT(buyItNowPrice)}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBinConfirm(false)} disabled={isPending} className="px-4 py-2 text-sm font-medium text-gray-600 rounded-xl">Cancel</button>
              <button onClick={confirmBuyItNow} disabled={isPending} className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-accent-600 hover:bg-accent-700">
                {isPending ? "Processing..." : "Confirm Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
