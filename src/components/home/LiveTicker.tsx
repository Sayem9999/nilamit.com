"use client";

import { useEffect, useState } from "react";
import { getClientDB } from "@/lib/firebase-client";
import { ref, onChildAdded, query, limitToLast } from "firebase/database";
import { RTDB_PATHS } from "@/lib/firebase-events";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Trophy } from "lucide-react";
import Link from "next/link";

interface TickerItem {
  id: string;
  event: string;
  bidderName: string;
  amount: number;
  auctionTitle: string;
  auctionId: string;
  timestamp: number;
}

export default function LiveTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    const rtdb = getClientDB();
    const activityRef = ref(rtdb, RTDB_PATHS.globalActivity());
    const q = query(activityRef, limitToLast(5));

    const unsubscribe = onChildAdded(q, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const newItem: TickerItem = {
        id: snapshot.key || Math.random().toString(),
        ...data,
      };

      setItems((prev) => {
        // Only add if not already present
        if (prev.find((i) => i.id === newItem.id)) return prev;
        const updated = [...prev, newItem].sort((a, b) => b.timestamp - a.timestamp);
        return updated.slice(0, 5);
      });
    });

    return () => unsubscribe();
  }, []);

  if (items.length === 0) return null;

  return (
    <aside aria-label="Live activity ticker" className="bg-gray-900 text-white overflow-hidden h-10 flex items-center border-b border-white/5">
      <div className="flex-shrink-0 px-4 bg-primary-600 h-full flex items-center gap-2 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <Zap className="w-4 h-4 fill-white text-white animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-tighter whitespace-nowrap">Live Ticker</span>
      </div>

      <div className="flex-1 overflow-hidden relative h-full flex items-center gap-2">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="inline-flex items-center px-4 whitespace-nowrap"
            >
              <Link
                href={`/auctions/${item.auctionId}`}
                aria-label={`${item.bidderName} placed ${item.amount} BDT on ${item.auctionTitle}`}
                className="flex items-center gap-2 text-[11px] hover:text-primary-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
              >
                <Trophy className="w-3 h-3 text-amber-500" aria-hidden="true" />
                <span className="font-bold text-gray-200">{item.bidderName}</span>
                <span className="text-gray-500">placed</span>
                <span className="font-bold text-primary-400">{item.amount} BDT</span>
                <span className="text-gray-500">on</span>
                <span className="truncate max-w-[200px] font-medium text-white underline decoration-gray-700 underline-offset-4">{item.auctionTitle}</span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
