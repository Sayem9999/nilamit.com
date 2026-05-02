"use client";

import { useEffect, useState, useRef } from "react";
import { ref, onChildAdded, query, limitToLast, off } from "firebase/database";
import { getAdminStats } from "@/actions/admin";
import { getClientDB } from "@/lib/firebase-client";
import { RTDB_PATHS } from "@/lib/firebase-events";
import { formatBDT } from "@/lib/format";
import { 
  Activity, 
  Gavel, 
  Clock, 
  ExternalLink, 
  ShieldAlert,
  Zap,
  User,
  Package
} from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";

interface GlobalBid {
  id: string;
  event: string;
  amount: number;
  bidderName: string;
  auctionTitle: string;
  auctionId: string;
  timestamp: number;
}

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalAuctions: number;
  activeAuctions: number;
  totalBids: number;
  totalRevenue: number;
  recentUsers: unknown[];
}

export default function AdminLiveFeed() {
  const [bids, setBids] = useState<GlobalBid[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLive, setIsLive] = useState(true);
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) return;

    const db = getClientDB();
    const globalRef = ref(db, RTDB_PATHS.globalActivity());
    const recentQuery = query(globalRef, limitToLast(50));

    const unsub = onChildAdded(recentQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const newBid: GlobalBid = {
        id: snapshot.key || Math.random().toString(),
        ...data
      };

      setBids(prev => {
        if (prev.find(b => b.id === newBid.id)) return prev;
        return [newBid, ...prev].slice(0, 100);
      });
    });

    // Fetch initial stats
    getAdminStats().then(res => {
      if (res.success && res.data) setStats(res.data);
    });

    return () => {
      off(recentQuery);
    };
  }, [isLive]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                <Activity className="w-6 h-6 text-white" />
              </div>
              Live Platform Ticker
            </h1>
            <p className="text-gray-500 font-medium mt-1">Real-time monitoring of all bidding activity across Nilamit.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                {isLive ? 'Live Stream Active' : 'Stream Paused'}
              </span>
            </div>
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                isLive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              {isLive ? 'Pause Feed' : 'Resume Feed'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Stats Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Bids</span>
                  <span className="font-bold text-gray-900">{stats?.totalBids?.toLocaleString() || "..."}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Auctions</span>
                  <span className="font-bold text-gray-900">{stats?.totalAuctions?.toLocaleString() || "..."}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Revenue</span>
                  <span className="font-bold text-primary-600">{stats ? formatBDT(stats.totalRevenue) : "..."}</span>
                </div>
              </div>
            </div>

            <div className="bg-primary-900 p-6 rounded-3xl text-white shadow-xl shadow-primary-900/20">
              <ShieldAlert className="w-8 h-8 text-primary-400 mb-4" />
              <h3 className="text-lg font-bold mb-2">Moderation Mode</h3>
              <p className="text-primary-200 text-xs leading-relaxed mb-4">
                Click on any bid to view full user history and auction details. Suspicious patterns are flagged automatically.
              </p>
              <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                View Risk Flags
              </button>
            </div>
          </div>

          {/* Feed List */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
              <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary-600" />
                  Recent Activity
                </span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Showing last {bids.length} events
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 max-h-[700px] custom-scrollbar" ref={scrollRef}>
                <AnimatePresence initial={false}>
                  {bids.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                      <Gavel className="w-16 h-16 mb-4" />
                      <p className="font-bold">Waiting for platform activity...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bids.map((bid) => (
                        <motion.div
                          key={bid.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="group bg-gray-50/50 hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 border border-transparent hover:border-gray-100 p-5 rounded-2xl transition-all duration-300 flex items-center gap-4"
                        >
                          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-600 group-hover:border-primary-600 transition-colors">
                            <Gavel className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-gray-900 tracking-tight uppercase text-xs">
                                {bid.bidderName}
                              </span>
                              <span className="text-[10px] text-gray-400 font-bold">•</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                {new Date(bid.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium truncate">
                              <Package className="w-3.5 h-3.5 flex-shrink-0" />
                              {bid.auctionTitle}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-black text-primary-600 tracking-tight">
                              {formatBDT(bid.amount)}
                            </div>
                            <Link 
                              href={`/${locale}/auctions/${bid.auctionId}`}
                              className="inline-flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-primary-600 uppercase tracking-widest transition-colors"
                            >
                              Details <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
