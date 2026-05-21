"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWatchlist } from "@/actions/watchlist";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
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
  const router = useRouter();
  const t = useTranslations("Watchlist");
  const [isPending, startTransition] = useTransition();
  const [isWatchlisted, setIsWatchlisted] = useState(initialIsWatchlisted);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.error(t("signInPrompt"));
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
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
          toast.error(result.error?.message || t("updateFailed"));
        }
      } else if (result.data?.watching !== undefined) {
        setIsWatchlisted(result.data.watching);
        toast.success(result.data.watching ? t("added") : t("removed"));
      }
    });
  };

  const label = isWatchlisted ? "Remove from watchlist" : "Add to watchlist";
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={label}
      aria-pressed={isWatchlisted}
      title={label}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        isWatchlisted
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-gray-500 hover:text-red-500 hover:bg-white"
      } ${hoverOnly ? "opacity-100 md:opacity-0 md:group-hover:opacity-100" : ""} ${className}`}
    >
      <Heart
        aria-hidden="true"
        className="w-5 h-5 transition-transform"
        fill={isWatchlisted ? "currentColor" : "none"}
      />
    </button>
  );
}
