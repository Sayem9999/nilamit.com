"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import toast from "react-hot-toast";

interface PriceAlertButtonProps {
  auctionId: string;
  currentPrice: number;
}

export function PriceAlertButton({
  auctionId,
  currentPrice,
}: PriceAlertButtonProps) {
  const [enabled, setEnabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(() => {
      setEnabled(!enabled);

      if (!enabled) {
        // Store in localStorage for now — can be upgraded to server-side
        const alerts = JSON.parse(localStorage.getItem("priceAlerts") || "{}");
        alerts[auctionId] = {
          price: currentPrice,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem("priceAlerts", JSON.stringify(alerts));
        toast.success("Price alert set! You'll be notified of changes.");
      } else {
        const alerts = JSON.parse(localStorage.getItem("priceAlerts") || "{}");
        delete alerts[auctionId];
        localStorage.setItem("priceAlerts", JSON.stringify(alerts));
        toast.success("Price alert removed");
      }
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
        enabled
          ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
          : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
      }`}
      title={enabled ? "Remove price alert" : "Set price alert"}
    >
      {enabled ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      {enabled ? "Alert Set" : "Price Alert"}
    </button>
  );
}
