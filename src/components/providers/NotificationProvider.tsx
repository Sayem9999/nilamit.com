"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { onChildAdded, ref } from "firebase/database";
import { getClientDB, ensureFirebaseAuth } from "@/lib/firebase-client";
import { registerExistingPushGrant } from "@/lib/fcm";
import { RTDB_PATHS, FIREBASE_EVENTS } from "@/lib/firebase-events";
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

    const userId = session.user.id;
    let unsub: (() => void) | null = null;

    void (async () => {
      // Authenticate Firebase client using our custom-token endpoint
      await ensureFirebaseAuth();

      // If the user has already granted notification permission, (re)register
      // their FCM token so background push actually delivers. Never prompts.
      void registerExistingPushGrant();

      const db           = getClientDB();
      const notifRef     = ref(db, RTDB_PATHS.userNotifications(userId));

      // onChildAdded fires for every existing child on attach, then for each new
      // one. Skip the backfill by ignoring items stamped before "now". Writers
      // stamp `timestamp` (with legacy `_ts` fallback); the old code only checked
      // `_ts`, which was never set — so every stored notification re-toasted on
      // each page load.
      const startTime    = Date.now();

      unsub = onChildAdded(notifRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const ts = Number(data.timestamp ?? data._ts ?? 0);
        if (ts && ts < startTime) return; // skip backfill of older notifications
        if (!ts) return; // undated legacy item — don't replay as a toast

        handleNotification(data);
      });
    })();

    return () => { unsub?.(); };
  }, [session?.user?.id]);

  return <>{children}</>;
}

// ─── Notification dispatcher ─────────────────────────────────────────────────

function handleNotification(data: Record<string, unknown>) {
  switch (data.event) {

    case FIREBASE_EVENTS.OUTBID_ALERT: {
      const title = "You've been outbid!";
      const body  = `Someone bid ৳${(data.amount as number)?.toLocaleString()} on "${data.auctionTitle}".`;
      showNotification(title, { body });
      toast(body, {
        icon: "🚨",
        duration: 8000,
        style: { border: "1px solid #ef4444", padding: "16px", color: "#ef4444", fontWeight: 500 },
      });
      break;
    }

    case FIREBASE_EVENTS.ENDING_SOON: {
      const title = "⏰ Auction Closing Soon!";
      const body  = `"${data.auctionTitle}" is ending soon. Current bid: ৳${(data.currentPrice as number)?.toLocaleString()}.`;
      showNotification(title, { body });
      toast.custom(
        (t) => (
          <div className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-sm w-full bg-white shadow-lg rounded-md pointer-events-auto border border-amber-200 flex items-start gap-3 p-4`}>
            <div className="text-2xl leading-none">⏰</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">Closing Soon!</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
              <a href={`/auctions/${data.auctionId}`} className="mt-2 inline-block text-xs font-bold text-amber-600 hover:text-amber-700">
                Bid Now →
              </a>
            </div>
          </div>
        ),
        { duration: 12000 }
      );
      break;
    }

    case FIREBASE_EVENTS.PRICE_ALERT: {
      const isTarget = data.type === "TARGET_REACHED";
      const title    = isTarget ? "🎯 Target Price Reached!" : "🚨 Outbid Alert!";
      const body     = isTarget
        ? `"${data.auctionTitle}" has reached ৳${(data.amount as number)?.toLocaleString()}, meeting your target of ৳${(data.threshold as number)?.toLocaleString()}.`
        : `New bid of ৳${(data.amount as number)?.toLocaleString()} on "${data.auctionTitle}". Click to counter!`;
      showNotification(title, { body });
      toast.custom(
        (t) => (
          <div className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-sm w-full bg-white shadow-md rounded-md pointer-events-auto border-2 ${isTarget ? "border-primary-500" : "border-red-500"} flex items-start gap-3 p-5`}>
            <div className="text-2xl leading-none">{isTarget ? "🎯" : "🚨"}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${isTarget ? "text-primary-600" : "text-red-600"}`}>{isTarget ? "Target Hit!" : "Outbid!"}</p>
              <p className="text-xs text-gray-700 mt-1 font-medium leading-relaxed">{body}</p>
              <a href={`/auctions/${data.auctionId}`} className={`mt-3 inline-block px-4 py-2 rounded-xl text-xs font-bold text-white transition-all ${isTarget ? "bg-primary-600 hover:bg-primary-700" : "bg-red-600 hover:bg-red-700"}`}>
                Go to Auction →
              </a>
            </div>
          </div>
        ),
        { duration: 10000 }
      );
      break;
    }

    case FIREBASE_EVENTS.NEW_BID: {
      // Pushed to the seller's inbox when their listing receives a bid.
      const body = `New bid of ৳${(data.amount as number)?.toLocaleString()} on "${data.auctionTitle}".`;
      toast(body, { duration: 5000, icon: "🔨" });
      break;
    }

    case FIREBASE_EVENTS.PAYMENT_SUCCESS: {
      // Pushed to the buyer when their escrow advance is verified/held.
      toast(`✅ ${data.message ?? "Payment verified — funds held in escrow."}`, { duration: 6000 });
      break;
    }

    case FIREBASE_EVENTS.AUCTION_CLOSED: {
      // Pushed to the seller when a listing ends (no sale / reserve not met).
      toast(`📦 ${data.message ?? "Your listing has ended."}`, { duration: 6000 });
      break;
    }

    case FIREBASE_EVENTS.CHAT_NOTIFICATION: {
      toast(`💬 New message: ${data.message ?? ""}`, { duration: 5000 });
      break;
    }

    case FIREBASE_EVENTS.ADVANCE_PAID: {
      toast(`✅ ${data.message ?? "Advance payment received!"}`, { duration: 6000 });
      break;
    }

    case FIREBASE_EVENTS.TRUST_UPDATE: {
      toast(`⭐ ${data.message ?? "Reputation updated!"}`, { duration: 5000 });
      break;
    }

    case FIREBASE_EVENTS.AUCTION_WON: {
      const body = `🏆 You won "${data.title}"! Final price: ৳${(data.amount as number)?.toLocaleString()}.`;
      showNotification("You Won!", { body });
      toast(body, { duration: 10000, icon: "🏆" });
      break;
    }

    case 'badge_earned': {
      const badge = data.badge as { label?: string; icon?: string } | undefined;
      toast(`${badge?.icon ?? "🏅"} Badge earned: ${badge?.label ?? "New Badge"}!`, { duration: 6000 });
      break;
    }

    case FIREBASE_EVENTS.NEW_LISTING: {
      const title = "New listing from a seller you follow";
      const body  = `"${data.auctionTitle}" just went live.`;
      showNotification(title, { body });
      toast.custom(
        (t) => (
          <div className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-sm w-full bg-white shadow-lg rounded-md pointer-events-auto border border-primary-100 flex items-start gap-3 p-4`}>
            <div className="text-2xl leading-none">🛍️</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">New listing</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
              <a href={`/auctions/${data.auctionId}`} className="mt-2 inline-block text-xs font-bold text-primary-600 hover:text-primary-700">
                View →
              </a>
            </div>
          </div>
        ),
        { duration: 10000 },
      );
      break;
    }

    case FIREBASE_EVENTS.NEW_QUESTION: {
      toast(`❓ New question on "${data.auctionTitle}"`, {
        duration: 6000,
        icon: "❓",
      });
      showNotification("New question on your listing", {
        body: `Open the auction to reply.`,
      });
      break;
    }

    case FIREBASE_EVENTS.QUESTION_ANSWERED: {
      const auctionTitle = (data.auctionTitle as string | null) ?? "your question";
      toast(`💬 Seller answered: ${auctionTitle}`, { duration: 6000 });
      break;
    }

    default:
      break;
  }
}
