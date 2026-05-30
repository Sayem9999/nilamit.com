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
  ExternalLink,
  ShieldAlert,
  Zap,
  Package,
} from "lucide-react";
import Link from "next/link";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) return;

    const db = getClientDB();
    const globalRef = ref(db, RTDB_PATHS.globalActivity());
    const recentQuery = query(globalRef, limitToLast(50));

    onChildAdded(recentQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const newBid: GlobalBid = {
        // RTDB always supplies a stable child key; the fallback is content-derived
        // (never random) so de-duplication by id stays correct.
        id: snapshot.key ?? `${data.timestamp ?? Date.now()}-${data.auctionId ?? 'evt'}`,
        ...data
      };

      setBids(prev => {
        if (prev.find(b => b.id === newBid.id)) return prev;
        return [newBid, ...prev].slice(0, 100);
      });
    });

    // Fetch initial stats
    getAdminStats().then(res => {
      if (res.success && res.data) setStats(res.data as AdminStats);
    });

    return () => {
      off(recentQuery);
    };
  }, [isLive]);

  return (
    <main className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <span
                className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20"
                aria-hidden="true"
              >
                <Activity className="w-6 h-6 text-white" />
              </span>
              Live Platform Ticker
            </h1>
            <p className="text-gray-500 font-medium mt-1">
              Real-time monitoring of all bidding activity across Nilamit.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm"
              role="status"
              aria-live="polite"
            >
              <span
                className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 animate-pulse motion-reduce:animate-none" : "bg-gray-300"}`}
                aria-hidden="true"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                {isLive ? "Live stream active" : "Stream paused"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLive(!isLive)}
              aria-pressed={!isLive}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                isLive
                  ? "bg-red-50 text-red-600 hover:bg-red-100 focus-visible:ring-red-500"
                  : "bg-green-50 text-green-600 hover:bg-green-100 focus-visible:ring-green-500"
              }`}
            >
              {isLive ? "Pause feed" : "Resume feed"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Stats Summary */}
          <aside aria-label="Platform summary" className="lg:col-span-1 space-y-6">
            <section
              aria-labelledby="quick-stats-heading"
              className="bg-white p-6 rounded-md border border-gray-100 shadow-sm"
            >
              <h2
                id="quick-stats-heading"
                className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4"
              >
                Quick stats
              </h2>
              <dl className="space-y-4">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Total bids</dt>
                  <dd className="font-bold text-gray-900">
                    {stats?.totalBids?.toLocaleString() || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Total auctions</dt>
                  <dd className="font-bold text-gray-900">
                    {stats?.totalAuctions?.toLocaleString() || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Total revenue</dt>
                  <dd className="font-bold text-primary-600">
                    {stats ? formatBDT(stats.totalRevenue) : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="moderation-mode-heading"
              className="bg-primary-900 p-6 rounded-md text-white shadow-xl shadow-primary-900/20"
            >
              <ShieldAlert className="w-8 h-8 text-primary-400 mb-4" aria-hidden="true" />
              <h2 id="moderation-mode-heading" className="text-lg font-bold mb-2">
                Moderation queue
              </h2>
              <p className="text-primary-200 text-xs leading-relaxed mb-4">
                The live ticker is read-only. Open disputes, advance-payment holds, and reported
                listings are actioned from the moderation panels below.
              </p>
              <Link
                href="/admin/disputes"
                className="block w-full text-center py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wide transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Open dispute queue
              </Link>
            </section>
          </aside>

          {/* Feed List */}
          <section aria-labelledby="recent-activity-heading" className="lg:col-span-3">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
              <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                <h2
                  id="recent-activity-heading"
                  className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  Recent activity
                </h2>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  Showing last {bids.length} events
                </span>
              </div>

              <div
                className="flex-1 overflow-y-auto p-6 max-h-[700px] custom-scrollbar"
                ref={scrollRef}
                aria-live="polite"
                aria-relevant="additions"
              >
                <AnimatePresence initial={false}>
                  {bids.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                      <Gavel className="w-16 h-16 mb-4 text-gray-300" aria-hidden="true" />
                      <p className="font-bold text-gray-500">Waiting for platform activity…</p>
                    </div>
                  ) : (
                    <ul className="space-y-4 list-none p-0">
                      {bids.map((bid) => (
                        <motion.li
                          key={bid.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="group bg-gray-50/50 hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 border border-transparent hover:border-gray-100 p-5 rounded-md transition-all duration-300 motion-reduce:transition-none flex items-center gap-4"
                        >
                          <div
                            className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-600 group-hover:border-primary-600 transition-colors motion-reduce:transition-none"
                            aria-hidden="true"
                          >
                            <Gavel className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors motion-reduce:transition-none" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-900 tracking-tight uppercase text-xs">
                                {bid.bidderName}
                              </span>
                              <span className="text-[10px] text-gray-400 font-bold" aria-hidden="true">
                                •
                              </span>
                              <time
                                dateTime={new Date(bid.timestamp).toISOString()}
                                className="text-[10px] text-gray-400 font-bold uppercase tracking-wide"
                              >
                                {new Date(bid.timestamp).toLocaleTimeString()}
                              </time>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium truncate">
                              <Package className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              {bid.auctionTitle}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-bold text-primary-600 tracking-tight">
                              {formatBDT(bid.amount)}
                            </div>
                            <Link
                              href={`/auctions/${bid.auctionId}`}
                              aria-label={`View details for ${bid.auctionTitle}`}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-primary-600 uppercase tracking-wide transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                            >
                              Details <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                            </Link>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
