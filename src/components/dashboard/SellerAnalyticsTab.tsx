"use client";

import { useMemo, useState } from "react";
import { Eye, Users, TrendingUp, Package } from "lucide-react";
import Link from "next/link";
import { formatBDT } from "@/lib/format";

interface ListingMetric {
  id: string;
  title: string;
  images: string[];
  status: string;
  viewCount: number;
  bidCount: number;
  currentPrice: number;
  startingPrice: number;
  conversionRate: number; // bids / views
}

/**
 * Seller analytics dashboard tab.
 *
 * Reads the seller's listings via a thin client fetch (already authenticated;
 * dashboard layout supplies the session). Renders per-listing impression /
 * bid / conversion-rate stats.
 *
 * No charts here yet — flat table is what sellers actually want first
 * (eBay-style). Charts come once we have ≥30 days of data per seller.
 */
export function SellerAnalyticsTab({
  listings,
}: {
  listings: ListingMetric[];
}) {
  const [sortBy, setSortBy] = useState<"views" | "bids" | "conv">("views");
  // Derive sorted view — pure computation, no effect needed. Avoids the
  // react-hooks/set-state-in-effect lint rule and is cheaper anyway.
  const view = useMemo(() => {
    return [...listings].sort((a, b) => {
      if (sortBy === "views") return b.viewCount - a.viewCount;
      if (sortBy === "bids") return b.bidCount - a.bidCount;
      return b.conversionRate - a.conversionRate;
    });
  }, [sortBy, listings]);

  // Top-line aggregates
  const totals = listings.reduce(
    (acc, l) => ({
      views: acc.views + (l.viewCount || 0),
      bids: acc.bids + (l.bidCount || 0),
      active: acc.active + (l.status === "ACTIVE" ? 1 : 0),
    }),
    { views: 0, bids: 0, active: 0 },
  );

  const overallConv = totals.views > 0 ? (totals.bids / totals.views) * 100 : 0;

  if (listings.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
        <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h3 className="font-bold text-gray-900 text-base">No listings yet</h3>
        <p className="text-sm text-gray-500 mt-1">
          Once you list items, you&apos;ll see per-listing impressions, bids, and conversion here.
        </p>
        <Link
          href="/auctions/create"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-md transition-colors"
        >
          List an item
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Seller Analytics</h2>

      {/* Aggregates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Eye className="w-4 h-4" />} label="Total views" value={totals.views.toLocaleString()} />
        <Stat icon={<Users className="w-4 h-4" />} label="Total bids" value={totals.bids.toLocaleString()} />
        <Stat icon={<Package className="w-4 h-4" />} label="Active listings" value={totals.active.toLocaleString()} />
        <Stat icon={<TrendingUp className="w-4 h-4" />} label="Conv. rate" value={`${overallConv.toFixed(1)}%`} />
      </div>

      {/* Per-listing table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Per-listing breakdown
          </span>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 mr-1">Sort:</span>
            {(["views", "bids", "conv"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={`px-2 py-1 rounded transition-colors ${
                  sortBy === k
                    ? "bg-primary-50 text-primary-700 font-bold"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {k === "views" ? "Views" : k === "bids" ? "Bids" : "Conversion"}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {view.slice(0, 20).map((l) => (
              <Link
                key={l.id}
                href={`/auctions/${l.id}`}
                className="grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-5 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{l.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Status: <span className="font-semibold">{l.status}</span>
                  </p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-bold text-gray-900">{(l.viewCount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">views</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-bold text-gray-900">{(l.bidCount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">bids</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className={`text-sm font-bold ${l.conversionRate >= 5 ? "text-emerald-600" : "text-gray-700"}`}>
                    {l.conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">conv.</p>
                </div>
                <div className="col-span-1 text-right">
                  <p className="text-sm font-bold text-primary-600 price">{formatBDT(l.currentPrice)}</p>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-3">
      <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-1.5">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
