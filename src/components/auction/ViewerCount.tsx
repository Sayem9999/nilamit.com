"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { onValue, onDisconnect, ref, set, remove } from "firebase/database";
import { getClientDB, getClientAuth, ensureFirebaseAuth } from "@/lib/firebase-client";
import { RTDB_PATHS } from "@/lib/firebase-events";

export function ViewerCount({ auctionId }: { auctionId: string }) {
  const t = useTranslations("BidPanel");
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    let mounted = true;
    const db = getClientDB();

    // Viewer presence logic
    void (async () => {
      try {
        await ensureFirebaseAuth();
        if (!mounted) return;
        const auth = getClientAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const presenceRef = ref(db, RTDB_PATHS.presence(auctionId, uid));
        
        // Setup onDisconnect BEFORE writing to DB to prevent zombie nodes
        onDisconnect(presenceRef).remove().catch(() => {});
        await set(presenceRef, { online: true, joinedAt: Date.now() });

        if (!mounted) {
          remove(presenceRef).catch(() => {});
        }
      } catch {
        // Presence is optional
      }
    })();

    // Watch total viewers
    const presenceParent = ref(db, RTDB_PATHS.presenceAuction(auctionId));
    const unsubPresence = onValue(presenceParent, (snapshot) => {
      if (!mounted) return;
      setViewers(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });

    return () => {
      mounted = false;
      unsubPresence();
      const auth = getClientAuth();
      const uid = auth.currentUser?.uid;
      if (uid) {
        remove(ref(db, RTDB_PATHS.presence(auctionId, uid))).catch(() => {});
      }
    };
  }, [auctionId]);

  if (viewers <= 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-medium animate-pulse">
      <Users className="w-3.5 h-3.5" />
      {viewers} {t("viewing", { fallback: "viewing" })}
    </div>
  );
}
