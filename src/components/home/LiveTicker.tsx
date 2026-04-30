"use client";

import { useEffect, useState } from "react";
import { rtdb } from "@/lib/firebase";
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
    <div className="bg-gray-900 text-white overflow-hidden h-10 flex items-center border-b border-white/5">
      <div className="flex-shrink-0 px-4 bg-primary-600 h-full flex items-center gap-2 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <Zap className="w-4 h-4 fill-white text-white animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">Live Ticker</span>
      </div>

      <div className="flex-1 overflow-hidden relative h-full">
        <AnimatePresence mode="popLayout">
          {items.slice(0, 1).map((item) => (
            <motion.div
              key={item.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="absolute inset-0 flex items-center px-4"
            >
              <Link 
                href={`/auction/${item.auctionId}`}
                className="flex items-center gap-3 text-xs hover:text-primary-400 transition-colors"
              >
                <Trophy className="w-3 h-3 text-amber-500" />
                <span className="font-bold text-gray-400">{item.bidderName}</span>
                <span className="text-gray-600">bid</span>
                <span className="font-black text-white">{item.amount} BDT</span>
                <span className="text-gray-600">on</span>
                <span className="truncate max-w-[150px] font-medium">{item.auctionTitle}</span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
