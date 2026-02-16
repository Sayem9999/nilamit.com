'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { placeBid } from '@/actions/bid';
import { formatBDT } from '@/lib/format';
import { TrendingUp, AlertCircle, CheckCircle, Shield, Clock } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { useSettings } from '@/context/SettingsContext';
import { pusherClient } from '@/lib/pusher-client';

interface BidPanelProps {
  auctionId: string;
  currentPrice: number;
  minBidIncrement: number;
  endTime: Date | string;
  isExpired: boolean;
  sellerId: string;
  onBidPlaced?: () => void;
}

export function BidPanel({
  auctionId,
  currentPrice,
  minBidIncrement,
  endTime,
  isExpired,
  sellerId,
  onBidPlaced,
}: BidPanelProps) {
  const { data: session } = useSession();
  const { soundEffectsEnabled } = useSettings();
  const [latestPrice, setLatestPrice] = useState(currentPrice);
  const [latestEndTime, setLatestEndTime] = useState(new Date(endTime));
  const [bidAmount, setBidAmount] = useState(currentPrice + minBidIncrement);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; error?: string; antiSnipeTriggered?: boolean } | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Phase 4: Real-time Updates via Pusher
  useEffect(() => {
    if (isExpired) return;

    const channel = pusherClient.subscribe(`auction-${auctionId}`);

    channel.bind('new-bid', (data: { amount: number; endTime: string | Date }) => {
      setLatestPrice(data.amount);
      setLatestEndTime(new Date(data.endTime));
    });

    return () => {
      pusherClient.unsubscribe(`auction-${auctionId}`);
    };
  }, [auctionId, isExpired]);

  // Sync bid amount if price changes and current amount is now too low
  useEffect(() => {
    const minRequired = latestPrice + minBidIncrement;
    if (bidAmount < minRequired) {
      setBidAmount(minRequired);
    }
  }, [latestPrice, minBidIncrement, bidAmount]);

  const minBid = latestPrice + minBidIncrement;
  const quickBids = [minBid, minBid + minBidIncrement * 2, minBid + minBidIncrement * 5];

  const handleBid = () => {
    if (!session) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }

    startTransition(async () => {
      const res = await placeBid(auctionId, bidAmount);
      setResult(res);
      if (res.success) {
        // Sound Effect
        if (soundEffectsEnabled) {
          const audio = new Audio('/sounds/gavel.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.error('Audio play failed:', e));
        }

        // Price will update via next poll or immediately here for better UX
        const newPrice = bidAmount;
        setLatestPrice(newPrice);
        setBidAmount(newPrice + minBidIncrement);
        onBidPlaced?.();
      }
      if (res.error === 'PHONE_NOT_VERIFIED') {
        setShowPhoneModal(true);
      }
    });
  };

  const isOwnAuction = session?.user?.id === sellerId;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Place Your Bid
        </h3>
        <div className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
          <Clock className="w-4 h-4" />
          <CountdownTimer endTime={latestEndTime} />
        </div>
      </div>

      {isExpired ? (
        <div className="text-center py-6">
          <p className="text-gray-500 font-medium">This auction has ended</p>
        </div>
      ) : isOwnAuction ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl">
          <p className="text-gray-500 text-sm">You cannot bid on your own auction</p>
        </div>
      ) : (
        <>
          {/* Current Price */}
          <div className="bg-primary-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-primary-600 font-medium mb-1">Current Price</p>
            <p className="price text-2xl text-primary-700">{formatBDT(latestPrice)}</p>
          </div>

          {/* Bid Input */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Your Bid (৳)</label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(Number(e.target.value))}
              min={minBid}
              step={minBidIncrement}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 price text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Minimum bid: {formatBDT(minBid)}</p>
          </div>

          {/* Quick Bid Buttons */}
          <div className="flex gap-2 mb-4">
            {quickBids.map((amount) => (
              <button
                key={amount}
                onClick={() => setBidAmount(amount)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  bidAmount === amount
                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {formatBDT(amount)}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleBid}
            disabled={isPending || bidAmount < minBid}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isPending ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>Bid {formatBDT(bidAmount)}</>
            )}
          </button>

          {/* Result */}
          {result && (
            <div className={`mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${
              result.success
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}>
              {result.success ? (
                <>
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Bid placed successfully!</p>
                    {result.antiSnipeTriggered && (
                      <p className="text-xs mt-1 text-green-600">⏱ Anti-sniping activated — auction extended by 2 minutes.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{result.error === 'PHONE_NOT_VERIFIED' ? 'Please verify your phone number to bid.' : result.error}</p>
                </>
              )}
            </div>
          )}

          {/* Trust indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <Shield className="w-3.5 h-3.5" />
            <span>Protected by anti-sniping & secure transactions</span>
          </div>
        </>
      )}

      {showPhoneModal && (
        <PhoneVerificationPrompt onClose={() => setShowPhoneModal(false)} />
      )}
    </div>
  );
}

function PhoneVerificationPrompt({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">Verify Your Phone</h3>
        <p className="text-sm text-gray-500 mb-4">
          To ensure trust in our marketplace, please verify your Bangladesh phone number (+880) before bidding.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Later
          </button>
          <a href="/profile" className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-primary-700">
            Verify Now
          </a>
        </div>
      </div>
    </div>
  );
}
