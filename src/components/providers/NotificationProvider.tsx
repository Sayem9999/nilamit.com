"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { pusherClient } from "@/lib/pusher-client";
import { showNotification } from "@/lib/notifications";
import { toast } from "react-hot-toast";

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;

    // Subscribe to the personal user channel
    const personalChannel = `user-${session.user.id}`;
    const channel = pusherClient.subscribe(personalChannel);

    // ── Outbid Alert ──────────────────────────────────
    channel.bind(
      "outbid-alert",
      (data: {
        auctionTitle: string;
        amount: number;
        auctionId: string;
        newBidderName?: string;
      }) => {
        const title = "You've been outbid!";
        const body = `Someone bid ৳${data.amount.toLocaleString()} on "${data.auctionTitle}".`;

        showNotification(title, { body });

        toast(body, {
          icon: "🚨",
          duration: 8000,
          style: {
            border: "1px solid #ef4444",
            padding: "16px",
            color: "#ef4444",
            fontWeight: 500,
          },
        });
      },
    );

    // ── Ending Soon Alert ──────────────────────────────
    channel.bind(
      "ending-soon",
      (data: {
        auctionTitle: string;
        currentPrice: number;
        auctionId: string;
        endTime: string;
      }) => {
        const title = "⏰ Auction Closing Soon!";
        const body = `"${data.auctionTitle}" is ending soon. Current bid: ৳${data.currentPrice.toLocaleString()}.`;

        showNotification(title, { body });

        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? "animate-enter" : "animate-leave"
              } max-w-sm w-full bg-white shadow-lg rounded-2xl pointer-events-auto border border-amber-200 flex items-start gap-3 p-4`}
            >
              <div className="text-2xl leading-none">⏰</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Closing Soon!</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
                <a
                  href={`/auctions/${data.auctionId}`}
                  className="mt-2 inline-block text-xs font-bold text-amber-600 hover:text-amber-700"
                >
                  Bid Now →
                </a>
              </div>
            </div>
          ),
          { duration: 12000 }
        );
      },
    );

    return () => {
      pusherClient.unsubscribe(personalChannel);
    };
  }, [session?.user?.id]);

  return <>{children}</>;
}
