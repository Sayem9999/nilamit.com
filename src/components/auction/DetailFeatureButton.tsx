"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFeaturedAuction } from "@/actions/admin-content";
import toast from "react-hot-toast";

interface DetailFeatureButtonProps {
  auctionId: string;
  initialIsFeatured?: boolean;
  isAdmin: boolean;
  className?: string;
}

export function DetailFeatureButton({
  auctionId,
  initialIsFeatured = false,
  isAdmin,
  className = "",
}: DetailFeatureButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isFeatured, setIsFeatured] = useState(initialIsFeatured);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAdmin) return;
    if (isPending) return;

    const previous = isFeatured;
    setIsFeatured(!previous);

    startTransition(async () => {
      const result = await toggleFeaturedAuction(auctionId, !previous);
      if (!result.success) {
        setIsFeatured(previous);
        toast.error("Failed to update featured status");
      } else {
        toast.success(!previous ? "Auction featured successfully!" : "Auction removed from featured!");
      }
    });
  };

  // If not admin and not featured, show nothing
  if (!isAdmin && !isFeatured) {
    return null;
  }

  const label = isFeatured ? "Featured listing" : "Feature listing";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending || !isAdmin}
      aria-label={label}
      aria-pressed={isFeatured}
      title={isAdmin ? (isFeatured ? "Remove from featured" : "Feature this listing") : "Curator's Choice (Featured Listing)"}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        isFeatured
          ? "bg-amber-50 text-amber-500 hover:bg-amber-100 border border-amber-200/50 shadow-sm scale-105"
          : "bg-white border border-gray-100 text-gray-400 hover:text-amber-500 hover:bg-amber-50/50"
      } ${!isAdmin ? "cursor-default select-none pointer-events-none" : "hover:scale-105"} ${className}`}
    >
      <Star
        aria-hidden="true"
        className="w-5 h-5 transition-transform"
        fill={isFeatured ? "currentColor" : "none"}
      />
    </button>
  );
}
