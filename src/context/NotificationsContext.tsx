"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { onValue, ref, query, limitToLast, remove } from "firebase/database";
import { getClientDB, ensureFirebaseAuth } from "@/lib/firebase-client";
import { RTDB_PATHS, FIREBASE_EVENTS } from "@/lib/firebase-events";
import { showNotification } from "@/lib/notifications";
import { toast } from "react-hot-toast";

export interface NotificationItem {
  id: string;
  event: string;
  _ts: number;
  [key: string]: unknown;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  dismiss: () => {},
  clearAll: () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

const LAST_SEEN_KEY = (uid: string) => `nilamit.notif.lastSeen.${uid}`;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | null = null;
    const mountedAt = Date.now();

    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SEEN_KEY(userId)) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(stored ? parseInt(stored, 10) : 0);

    void (async () => {
      await ensureFirebaseAuth();
      const db = getClientDB();
      const notifRef = query(
        ref(db, RTDB_PATHS.userNotifications(userId)),
        limitToLast(50),
      );

      unsub = onValue(notifRef, (snap) => {
        const val = snap.val() as Record<string, Omit<NotificationItem, "id">> | null;
        if (!val) {
          setNotifications([]);
          return;
        }
        const items: NotificationItem[] = Object.entries(val)
          .map(([id, data]) => ({ id, ...data } as NotificationItem))
          .sort((a, b) => (b._ts ?? 0) - (a._ts ?? 0));

        setNotifications(items);

        const fresh = items.filter(i => (i._ts ?? 0) > mountedAt);
        fresh.forEach(fireToast);
      });
    })();

    return () => {
      unsub?.();
       
      setNotifications([]);
    };
  }, [userId]);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    const now = Date.now();
    setLastSeen(now);
    try { window.localStorage.setItem(LAST_SEEN_KEY(userId), String(now)); } catch {}
  }, [userId]);

  const dismiss = useCallback((id: string) => {
    if (!userId) return;
    setNotifications(prev => prev.filter(n => n.id !== id));
    void (async () => {
      try {
        await ensureFirebaseAuth();
        await remove(ref(getClientDB(), `${RTDB_PATHS.userNotifications(userId)}/${id}`));
      } catch {}
    })();
  }, [userId]);

  const clearAll = useCallback(() => {
    if (!userId) return;
    setNotifications([]);
    void (async () => {
      try {
        await ensureFirebaseAuth();
        await remove(ref(getClientDB(), RTDB_PATHS.userNotifications(userId)));
      } catch {}
    })();
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter(n => (n._ts ?? 0) > lastSeen).length,
    [notifications, lastSeen],
  );

  const value: NotificationsContextValue = useMemo(
    () => ({ notifications, unreadCount, markAllRead, dismiss, clearAll }),
    [notifications, unreadCount, markAllRead, dismiss, clearAll],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

function fireToast(n: NotificationItem) {
  switch (n.event) {
    case FIREBASE_EVENTS.OUTBID_ALERT: {
      const body = `Someone bid ৳${(n.amount as number)?.toLocaleString?.() ?? n.amount} on "${n.auctionTitle}".`;
      showNotification("You've been outbid!", { body });
      toast(body, { icon: "🚨", duration: 6000 });
      break;
    }
    case FIREBASE_EVENTS.ENDING_SOON: {
      const body = `"${n.auctionTitle}" is ending soon.`;
      showNotification("⏰ Closing Soon", { body });
      toast(body, { icon: "⏰", duration: 6000 });
      break;
    }
    case FIREBASE_EVENTS.PRICE_ALERT: {
      const body = `Price alert on "${n.auctionTitle}".`;
      showNotification("🎯 Price Alert", { body });
      toast(body, { icon: "🎯", duration: 6000 });
      break;
    }
    case FIREBASE_EVENTS.AUCTION_WON: {
      const body = `🏆 You won "${n.title}"!`;
      showNotification("You won!", { body });
      toast(body, { icon: "🏆", duration: 8000 });
      break;
    }
    case FIREBASE_EVENTS.CHAT_NOTIFICATION: {
      toast(`💬 ${n.message ?? "New message"}`, { duration: 4000 });
      break;
    }
    case FIREBASE_EVENTS.ADVANCE_PAID:
    case FIREBASE_EVENTS.TRUST_UPDATE:
    case "badge_earned": {
      toast(String(n.message ?? "Update"), { duration: 4000 });
      break;
    }
    default:
      break;
  }
}
