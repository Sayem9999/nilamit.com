"use client";

import { useState } from "react";
import { createAlert } from "@/actions/alerts";
import { Bell, Loader2, Target, Zap } from "lucide-react";
import { toast } from "react-hot-toast";

interface PriceAlertButtonProps {
  auctionId: string;
  currentPrice: number;
}

export default function PriceAlertButton({
  auctionId,
  currentPrice,
}: PriceAlertButtonProps) {
  const [isSetting, setIsSetting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threshold, setThreshold] = useState(currentPrice + 100);
  const [mode, setMode] = useState<"OUTBID" | "TARGET_REACHED">("TARGET_REACHED");

  const handleSetAlert = async () => {
    setIsLoading(true);
    const result = await createAlert({
      type: mode,
      auctionId,
      thresholdPrice: mode === "TARGET_REACHED" ? threshold : undefined,
    });
    setIsLoading(false);

    if (result.success) {
      toast.success(
        mode === "TARGET_REACHED" 
          ? `Alert set for ৳${threshold.toLocaleString()}!`
          : "We'll notify you if you're outbid!"
      );
      setIsSetting(false);
    } else {
      toast.error(result.error?.message || "Failed to set alert");
    }
  };

  if (isSetting) {
    return (
      <div className="flex flex-col gap-4 p-5 bg-white rounded-md border border-gray-100 shadow-premium animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-600" />
            Set Auction Alert
          </span>
          <button
            onClick={() => setIsSetting(false)}
            className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-md">
          <button
            onClick={() => setMode("TARGET_REACHED")}
            className={`py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mode === "TARGET_REACHED"
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Price Target
          </button>
          <button
            onClick={() => setMode("OUTBID")}
            className={`py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mode === "OUTBID"
                ? "bg-white text-primary-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Outbid Follow
          </button>
        </div>

        {mode === "TARGET_REACHED" ? (
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-transparent rounded-md text-base font-bold focus:bg-white focus:border-primary-500 outline-none transition-all"
                placeholder="Target price..."
              />
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              One-time notification when the price reaches or exceeds this amount.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 leading-tight bg-primary-50 p-3 rounded-md">
            Get notified immediately every time another user outbids the current high bid.
          </p>
        )}

        <button
          onClick={handleSetAlert}
          disabled={isLoading || (mode === "TARGET_REACHED" && threshold <= currentPrice)}
          className="w-full py-4 bg-gray-900 text-white rounded-md font-bold hover:bg-gray-800 disabled:opacity-50 disabled:bg-gray-400 transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>Activate Tracking</>
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsSetting(true)}
      className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all"
    >
      <Bell className="w-4 h-4 text-primary-500" />
      <span>Track Auction</span>
    </button>
  );
}
