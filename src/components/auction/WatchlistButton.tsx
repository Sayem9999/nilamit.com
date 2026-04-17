"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWatchlist } from "@/actions/watchlist";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

interface WatchlistButtonProps {
  auctionId: string;
  initialIsWatchlisted?: boolean;
  className?: string;
  hoverOnly?: boolean;
}

export function WatchlistButton({
  auctionId,
  initialIsWatchlisted = false,
  className = "",
  hoverOnly = false,
}: WatchlistButtonProps) {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();
  const [isWatchlisted, setIsWatchlisted] = useState(initialIsWatchlisted);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.error("Please sign in to add to watchlist");
      return;
    }

    // Optimistic update
    setIsWatchlisted(!isWatchlisted);

    startTransition(async () => {
      const result = await toggleWatchlist(auctionId);
      if (!result.success) {
        setIsWatchlisted(isWatchlisted);
        if (result.error !== "Unauthorized") {
          toast.error(result.error || "Failed to update watchlist");
        }
      } else if (result.watching !== undefined) {
        setIsWatchlisted(result.watching);
        toast.success(
          result.watching
            ? "Added to watchlist"
            : "Removed from watchlist",
        );
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={isWatchlisted}
      className={`p-2 rounded-full backdrop-blur-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        isWatchlisted
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-gray-500 hover:text-red-500 hover:bg-white"
      } ${hoverOnly ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : ""} ${className}`}
      title={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
    >
      <Heart
        className="w-5 h-5 transition-transform"
        fill={isWatchlisted ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}
