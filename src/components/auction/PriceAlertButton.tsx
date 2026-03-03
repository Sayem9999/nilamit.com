"use client";

import { useState } from "react";
import { createAlert } from "@/actions/alerts";
import { Bell, Loader2 } from "lucide-react";
import { AlertType } from "@prisma/client";
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
  const [threshold, setThreshold] = useState(currentPrice);

  const handleSetAlert = async () => {
    setIsLoading(true);
    const result = await createAlert(
      "PRICE_DROP" as AlertType,
      auctionId,
      threshold,
    );
    setIsLoading(false);

    if (result.success) {
      toast.success("Price alert set successfully!");
      setIsSetting(false);
    } else {
      toast.error(result.error || "Failed to set alert");
    }
  };

  if (isSetting) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Set Price Threshold
          </span>
          <button
            onClick={() => setIsSetting(false)}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Alert price..."
          />
          <button
            onClick={handleSetAlert}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
          </button>
        </div>
        <p className="text-[10px] text-gray-400">
          We will notify you if the price drops below this amount.
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsSetting(true)}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
    >
      <Bell className="w-4 h-4" />
      <span>Track Price</span>
    </button>
  );
}
