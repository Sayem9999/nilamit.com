"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, BellOff } from "lucide-react";
import toast from "react-hot-toast";
import { followSeller, unfollowSeller } from "@/actions/seller-follow";

interface FollowSellerButtonProps {
  sellerId: string;
  initialFollowing: boolean;
  initialFollowerCount: number;
  /** Hide entirely if the viewer IS the seller — no self-follow. */
  hideForSelf?: boolean;
}

export function FollowSellerButton({
  sellerId,
  initialFollowing,
  initialFollowerCount,
  hideForSelf = true,
}: FollowSellerButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("Follow");
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowerCount);
  const [isPending, startTransition] = useTransition();

  if (hideForSelf && session?.user?.id === sellerId) return null;

  const handleClick = () => {
    if (!session?.user?.id) {
      // Punt to login; preserve intent so the redirect lands back here.
      router.push(`/login?callbackUrl=/seller/${sellerId}`);
      return;
    }

    const wasFollowing = following;
    // Optimistic flip — fast feedback, revert on error.
    setFollowing(!wasFollowing);
    setCount((c) => (wasFollowing ? Math.max(0, c - 1) : c + 1));

    startTransition(async () => {
      const action = wasFollowing ? unfollowSeller : followSeller;
      const res = await action({ sellerId });
      if (!res.success) {
        setFollowing(wasFollowing);
        setCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)));
        toast.error(res.error?.message ?? t("followError"));
        return;
      }
      toast.success(wasFollowing ? t("unfollowToast") : t("followToast"));
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
        following
          ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
          : "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
      }`}
    >
      {following ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      <span>{following ? t("following") : t("follow")}</span>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
        following ? "bg-white/60 text-gray-600" : "bg-white/20 text-white/90"
      }`}>
        {count}
      </span>
    </button>
  );
}
