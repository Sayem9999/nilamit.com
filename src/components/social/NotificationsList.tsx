"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Bell,
  MessageSquare,
  Trash2,
  Trophy,
  CheckCircle,
  AlertTriangle,
  BadgeAlert,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Loader2
} from "lucide-react";
import { getClientDB, ensureFirebaseAuth } from "@/lib/firebase-client";
import { ref, onValue, remove, set } from "firebase/database";
import Link from "next/link";

interface NotificationItem {
  id: string;
  event: string;
  amount?: number;
  auctionId?: string;
  auctionTitle?: string;
  message?: string;
  title?: string;
  badge?: {
    label?: string;
    icon?: string;
  };
  _ts: number;
}

export function NotificationsList() {
  const { data: session } = useSession();
  const t = useTranslations("Dashboard");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState<number>(() => Date.now());

  const userId = session?.user?.id;

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let unsub: (() => void) | null = null;
    const loadingTimer = setTimeout(() => {
      setIsLoading(true);
    }, 0);

    void (async () => {
      try {
        await ensureFirebaseAuth();
        const db = getClientDB();
        const notifRef = ref(db, `notifications/user/${userId}`);

        unsub = onValue(notifRef, (snapshot) => {
          const data = snapshot.val() as Record<string, Omit<NotificationItem, "id">> | null;
          if (data) {
            const list = Object.entries(data).map(([key, val]) => ({
              id: key,
              ...val,
              _ts: val._ts || Date.now(),
            }));
            // Sort by timestamp descending
            list.sort((a, b) => b._ts - a._ts);
            setNotifications(list);
          } else {
            setNotifications([]);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Failed to subscribe to notifications:", error);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to subscribe to notifications", err);
        setIsLoading(false);
      }
    })();

    return () => {
      unsub?.();
      clearTimeout(loadingTimer);
    };
  }, [userId]);

  const handleClearAll = async () => {
    if (!userId) return;
    try {
      const db = getClientDB();
      await set(ref(db, `notifications/user/${userId}`), null);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    try {
      const db = getClientDB();
      await remove(ref(db, `notifications/user/${userId}/${id}`));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  function formatTimeAgo(ts: number, referenceTime: number) {
    if (!referenceTime) return "Just now";
    const diff = referenceTime - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const getNotificationConfig = (item: NotificationItem) => {
    switch (item.event) {
      case "outbid_alert":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
          bgColor: "bg-red-50 dark:bg-red-950/20",
          borderColor: "border-red-100 dark:border-red-950/30",
          title: "You've been outbid!",
          body: `Someone bid ৳${item.amount?.toLocaleString()} on "${item.auctionTitle}".`,
          link: `/auctions/${item.auctionId}`,
          linkText: "Bid Now",
        };
      case "ending_soon":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          bgColor: "bg-amber-50 dark:bg-amber-950/20",
          borderColor: "border-amber-100 dark:border-amber-950/30",
          title: "Auction Closing Soon!",
          body: `"${item.auctionTitle}" is ending soon. Current bid: ৳${item.amount?.toLocaleString() || "N/A"}.`,
          link: `/auctions/${item.auctionId}`,
          linkText: "Bid Now",
        };
      case "price_alert":
        return {
          icon: <BadgeAlert className="w-5 h-5 text-amber-500" />,
          bgColor: "bg-amber-50 dark:bg-amber-950/20",
          borderColor: "border-amber-100 dark:border-amber-950/30",
          title: item.title || "Price Alert!",
          body: item.message || `Price milestone reached on "${item.auctionTitle}".`,
          link: `/auctions/${item.auctionId}`,
          linkText: "View Auction",
        };
      case "chat_notification":
        return {
          icon: <MessageSquare className="w-5 h-5 text-purple-500" />,
          bgColor: "bg-purple-50 dark:bg-purple-950/20",
          borderColor: "border-purple-100 dark:border-purple-950/30",
          title: "New Chat Message",
          body: item.message || "You have a new message.",
          link: `/dashboard?tab=coordination`,
          linkText: "Open Inbox",
        };
      case "advance_paid":
        return {
          icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
          bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
          borderColor: "border-emerald-100 dark:border-emerald-950/30",
          title: "Advance Paid!",
          body: item.message || "Advance payment has been registered successfully.",
          link: `/dashboard?tab=coordination`,
          linkText: "View Coordination",
        };
      case "trust_update":
        return {
          icon: <Sparkles className="w-5 h-5 text-indigo-500" />,
          bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
          borderColor: "border-indigo-100 dark:border-indigo-950/30",
          title: "Reputation Update",
          body: item.message || "Your trust rating has been updated.",
          link: "/profile",
          linkText: "View Profile",
        };
      case "auction_won":
        return {
          icon: <Trophy className="w-5 h-5 text-yellow-500" />,
          bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
          borderColor: "border-yellow-100 dark:border-yellow-950/30",
          title: "Congratulations! You Won!",
          body: `You won the auction "${item.auctionTitle || item.title || "item"}"! Final price: ৳${item.amount?.toLocaleString() || ""}.`,
          link: `/dashboard?tab=escrow`,
          linkText: "Complete Escrow",
        };
      case "badge_earned":
        return {
          icon: <Trophy className="w-5 h-5 text-blue-500" />,
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          borderColor: "border-blue-100 dark:border-blue-950/30",
          title: "Badge Earned!",
          body: `You earned the badge: ${item.badge?.icon || "🏅"} ${item.badge?.label || "New Achievement"}.`,
          link: "/profile",
          linkText: "View Profile",
        };
      case "new_listing":
        return {
          icon: <Bell className="w-5 h-5 text-blue-500" />,
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          borderColor: "border-blue-100 dark:border-blue-950/30",
          title: "New Auction Alert",
          body: `"${item.auctionTitle}" has been posted by a seller you follow.`,
          link: `/auctions/${item.auctionId}`,
          linkText: "View Listing",
        };
      case "new_question":
        return {
          icon: <HelpCircle className="w-5 h-5 text-purple-500" />,
          bgColor: "bg-purple-50 dark:bg-purple-950/20",
          borderColor: "border-purple-100 dark:border-purple-950/30",
          title: "New Question Received",
          body: `A buyer asked a question about "${item.auctionTitle}".`,
          link: `/auctions/${item.auctionId}`,
          linkText: "Reply Now",
        };
      case "question_answered":
        return {
          icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          borderColor: "border-blue-100 dark:border-blue-950/30",
          title: "Question Answered",
          body: `The seller replied to your question on "${item.auctionTitle}".`,
          link: `/auctions/${item.auctionId}`,
          linkText: "View Answer",
        };
      default:
        return {
          icon: <Bell className="w-5 h-5 text-gray-500" />,
          bgColor: "bg-gray-50 dark:bg-gray-950/20",
          borderColor: "border-gray-100 dark:border-gray-950/30",
          title: item.title || "Notification",
          body: item.message || "A system event has occurred.",
          link: undefined,
          linkText: undefined,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-4 font-semibold">Loading your inbox...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-gray-900 dark:text-white">
          {t("notifications")} ({notifications.length})
        </h2>
        {notifications.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-gray-100 hover:border-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("clearAll")}
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((item) => {
            const config = getNotificationConfig(item);
            return (
              <div
                key={item.id}
                className={`p-4 border rounded-2xl flex items-start justify-between gap-4 transition-all duration-300 ${config.bgColor} ${config.borderColor} hover:shadow-sm`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100/50 dark:border-slate-800 flex-shrink-0">
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                        {config.title}
                      </p>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold whitespace-nowrap">
                        {formatTimeAgo(item._ts, now)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                      {config.body}
                    </p>
                    {config.link && (
                      <Link
                        href={config.link}
                        className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors group"
                      >
                        {config.linkText}
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-gray-300 hover:text-red-500 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800 transition-colors self-start ml-2 flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-850 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-slate-800">
            <Bell className="w-6 h-6 text-gray-300 dark:text-slate-600" />
          </div>
          <p className="text-gray-500 dark:text-slate-400 font-medium">{t("emptyNotifications")}</p>
        </div>
      )}
    </div>
  );
}
