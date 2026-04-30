"use client";

import { useState, useEffect } from "react";
import { getKeyMetrics, type KeyMetrics } from "@/actions/admin-metrics";
import {
  TrendingUp,
  Users,
  Package,
  Gavel,
  DollarSign,
  Clock,
  Repeat,
  BarChart3,
  Target,
  Zap,
} from "lucide-react";

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold font-heading text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function MiniBarChart({
  data,
  color = "bg-indigo-500",
}: {
  data: { date: string; count: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((d, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t-sm ${color} transition-all hover:opacity-80`}
          style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

export function MetricsTab() {
  const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getKeyMetrics();
        if (mounted && res.success && res.data) {
          setMetrics(res.data);
        }
      } catch {
        // User not admin or error
      }
      if (mounted) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <p className="text-center text-gray-500 py-20">Failed to load metrics.</p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-heading font-bold text-gray-900">
          Key Business Metrics
        </h2>
        <p className="text-sm text-gray-500">Platform health at a glance</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Liquidity Rate"
          value={`${metrics.liquidityRate}%`}
          subtitle="Listings with ≥1 bid"
          icon={<Target className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <MetricCard
          label="Sell-Through Rate"
          value={`${metrics.sellThroughRate}%`}
          subtitle="Auctions completed"
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <MetricCard
          label="Repeat Seller Rate"
          value={`${metrics.repeatSellerRate}%`}
          subtitle="Sellers with 2+ listings"
          icon={<Repeat className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
        />
        <MetricCard
          label="Avg Bids/Auction"
          value={metrics.avgBidsPerAuction}
          subtitle="Competition health"
          icon={<Gavel className="w-5 h-5 text-orange-600" />}
          color="bg-orange-50"
        />
        <MetricCard
          label="Time to First Bid"
          value={`${metrics.avgTimeToFirstBidHours}h`}
          subtitle="Avg hours"
          icon={<Clock className="w-5 h-5 text-rose-600" />}
          color="bg-rose-50"
        />
      </div>

      {/* Volume Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total GMV"
          value={`৳${metrics.totalGMV.toLocaleString()}`}
          subtitle="Gross merchandise value"
          icon={<DollarSign className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
        <MetricCard
          label="Avg Auction Value"
          value={`৳${metrics.avgAuctionValue.toLocaleString()}`}
          icon={<BarChart3 className="w-5 h-5 text-indigo-600" />}
          color="bg-indigo-50"
        />
        <MetricCard
          label="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          subtitle={`+${metrics.newUsersLast7Days} this week`}
          icon={<Users className="w-5 h-5 text-cyan-600" />}
          color="bg-cyan-50"
        />
        <MetricCard
          label="Active Auctions"
          value={metrics.activeAuctions}
          subtitle={`${metrics.completedAuctions} completed total`}
          icon={<Package className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-semibold text-gray-900">
                Daily Bids
              </h3>
              <p className="text-xs text-gray-400">Last 30 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
              <Zap className="w-4 h-4" />
              {metrics.bidsLast7Days} this week
            </div>
          </div>
          <MiniBarChart data={metrics.dailyBids} color="bg-indigo-500" />
          <div className="flex justify-between mt-2 text-[10px] text-gray-400">
            <span>{metrics.dailyBids[0]?.date.slice(5)}</span>
            <span>
              {metrics.dailyBids[metrics.dailyBids.length - 1]?.date.slice(5)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-semibold text-gray-900">
                Daily Signups
              </h3>
              <p className="text-xs text-gray-400">Last 30 days</p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <Users className="w-4 h-4" />
              {metrics.newUsersLast30Days} this month
            </div>
          </div>
          <MiniBarChart data={metrics.dailySignups} color="bg-emerald-500" />
          <div className="flex justify-between mt-2 text-[10px] text-gray-400">
            <span>{metrics.dailySignups[0]?.date.slice(5)}</span>
            <span>
              {metrics.dailySignups[
                metrics.dailySignups.length - 1
              ]?.date.slice(5)}
            </span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {metrics.topCategories.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-heading font-semibold text-gray-900 mb-4">
            Top Categories
          </h3>
          <div className="space-y-3">
            {metrics.topCategories.map((cat) => {
              const pct =
                metrics.totalAuctions > 0
                  ? (cat.count / metrics.totalAuctions) * 100
                  : 0;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-32 truncate capitalize">
                    {cat.category.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500 w-12 text-right">
                    {cat.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
