"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Bell, X, Gavel, Clock, Trophy, MessageSquare, Target, Sparkles, CheckCheck } from "lucide-react";
import { useNotifications, type NotificationItem } from "@/context/NotificationsContext";
import { FIREBASE_EVENTS } from "@/lib/firebase-events";

function iconFor(event: string) {
  switch (event) {
    case FIREBASE_EVENTS.OUTBID_ALERT:  return { Icon: Gavel,         color: "bg-red-50 text-red-600" };
    case FIREBASE_EVENTS.ENDING_SOON:   return { Icon: Clock,         color: "bg-amber-50 text-amber-600" };
    case FIREBASE_EVENTS.PRICE_ALERT:   return { Icon: Target,        color: "bg-emerald-50 text-emerald-600" };
    case FIREBASE_EVENTS.AUCTION_WON:   return { Icon: Trophy,        color: "bg-yellow-50 text-yellow-600" };
    case FIREBASE_EVENTS.CHAT_NOTIFICATION: return { Icon: MessageSquare, color: "bg-blue-50 text-blue-600" };
    default:                            return { Icon: Sparkles,      color: "bg-primary-50 text-primary-600" };
  }
}

function titleFor(n: NotificationItem): string {
  switch (n.event) {
    case FIREBASE_EVENTS.OUTBID_ALERT:   return "You've been outbid";
    case FIREBASE_EVENTS.ENDING_SOON:    return "Auction closing soon";
    case FIREBASE_EVENTS.PRICE_ALERT:    return n.type === "TARGET_REACHED" ? "Target price reached" : "Price alert";
    case FIREBASE_EVENTS.AUCTION_WON:    return "You won an auction";
    case FIREBASE_EVENTS.CHAT_NOTIFICATION: return "New message";
    case FIREBASE_EVENTS.ADVANCE_PAID:   return "Advance received";
    case FIREBASE_EVENTS.TRUST_UPDATE:   return "Reputation updated";
    case "badge_earned":                 return "Badge earned";
    default:                             return "Notification";
  }
}

function bodyFor(n: NotificationItem): string {
  const amt = (n.amount as number | undefined)?.toLocaleString?.();
  switch (n.event) {
    case FIREBASE_EVENTS.OUTBID_ALERT:      return `New bid of ৳${amt} on "${n.auctionTitle}".`;
    case FIREBASE_EVENTS.ENDING_SOON:       return `"${n.auctionTitle}" ends soon.`;
    case FIREBASE_EVENTS.PRICE_ALERT:       return `"${n.auctionTitle}" — ৳${amt}.`;
    case FIREBASE_EVENTS.AUCTION_WON:       return `"${n.title}" — final ৳${amt}.`;
    case FIREBASE_EVENTS.CHAT_NOTIFICATION: return String(n.message ?? "");
    default:                                return String(n.message ?? "");
  }
}

function relativeTime(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function hrefFor(n: NotificationItem, locale: string): string | null {
  if (n.auctionId) return `/${locale}/auctions/${n.auctionId}`;
  if (n.conversationId) return `/${locale}/dashboard/coordination/${n.conversationId}`;
  return null;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen(v => {
      const next = !v;
      if (next && unreadCount > 0) {
        setTimeout(markAllRead, 1500);
      }
      return next;
    });
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative p-2 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-150"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Notifications</h3>
              <p className="text-[11px] text-gray-400">
                {notifications.length === 0
                  ? "You're all caught up"
                  : `${notifications.length} total${unreadCount ? ` · ${unreadCount} new` : ""}`}
              </p>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[11px] font-semibold text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1"
                aria-label="Clear all notifications"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Clear all
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No notifications yet</p>
                <p className="text-[11px] text-gray-400 mt-1">Bids, wins, and alerts will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((n) => {
                  const { Icon, color } = iconFor(n.event);
                  const href = hrefFor(n, locale);
                  const Inner = (
                    <div className="flex items-start gap-3 px-4 py-3 group">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{titleFor(n)}</p>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{bodyFor(n)}</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium">{relativeTime(n._ts)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
                        className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                        aria-label="Dismiss notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                  return (
                    <li key={n.id} className="hover:bg-gray-50/80 transition-colors">
                      {href ? (
                        <Link href={href} onClick={() => setOpen(false)} className="block">
                          {Inner}
                        </Link>
                      ) : (
                        Inner
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
