"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWatchlist } from "@/actions/watchlist";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isWatchlisted, setIsWatchlisted] = useState(initialIsWatchlisted);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.error("Please sign in to add to watchlist");
      return;
    }

    if (isPending) return;

    // Snapshot the pre-toggle state OUTSIDE startTransition so rollback uses
    // the real previous value, not whatever closure `isWatchlisted` has at
    // the time the server responds.
    const previous = isWatchlisted;
    setIsWatchlisted(!previous);

    startTransition(async () => {
      const result = await toggleWatchlist(auctionId);
      if (!result.success) {
        setIsWatchlisted(previous);
        if (result.error?.type !== "UNAUTHORIZED_ERROR") {
          toast.error(result.error?.message || "Failed to update watchlist");
        }
      } else if (result.data?.watching !== undefined) {
        setIsWatchlisted(result.data.watching);
        toast.success(
          result.data.watching
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
      className={`p-2 rounded-full backdrop-blur-md transition-all ${
        isWatchlisted
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-gray-500 hover:text-red-500 hover:bg-white"
      } ${hoverOnly ? "opacity-0 group-hover:opacity-100" : ""} ${className}`}
      title={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
    >
      <Heart
        className="w-5 h-5 transition-transform"
        fill={isWatchlisted ? "currentColor" : "none"}
      />
    </button>
  );
}
