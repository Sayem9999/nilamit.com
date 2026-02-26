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

    channel.bind(
      "outbid-alert",
      (data: {
        auctionTitle: string;
        amount: number;
        newBidderName?: string;
      }) => {
        const title = "You've been outbid!";
        const body = `Someone bid ৳${data.amount.toLocaleString()} on "${data.auctionTitle}".`;

        // Show native browser notification if enabled
        showNotification(title, { body });

        // Always show an in-app toast
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

    return () => {
      pusherClient.unsubscribe(personalChannel);
    };
  }, [session?.user?.id]);

  return <>{children}</>;
}
