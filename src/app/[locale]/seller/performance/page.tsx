import { getSellerPerformance } from "@/actions/seller-success";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  BarChart3,
  Package,
  DollarSign,
  Zap,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from "lucide-react";

export default async function SellerSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const metrics = await getSellerPerformance();
  if (!metrics) return null;

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">
              Seller Success Center
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />{" "}
              Real-time Analytics
            </span>
          </div>
          <h1 className="text-4xl font-heading font-bold text-gray-900">
            Performance Insights
          </h1>
          <p className="text-gray-600 mt-2">
            Data-driven strategies to maximize your sales on nilamit.com
          </p>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <MetricCard
            title="Total Revenue"
            value={`৳${metrics.totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="w-6 h-6" />}
            trend="+12.4%"
            isPositive={true}
          />
          <MetricCard
            title="Auctions Sold"
            value={metrics.soldCount}
            icon={<Package className="w-6 h-6" />}
            trend="+5"
            isPositive={true}
          />
          <MetricCard
            title="Sell-Through"
            value={`${metrics.sellThroughRate}%`}
            icon={<BarChart3 className="w-6 h-6" />}
            trend="-2.1%"
            isPositive={false}
          />
          <MetricCard
            title="Trust Score"
            value={metrics.avgSalePrice}
            icon={<Award className="w-6 h-6" />}
            trend="Growing"
            isPositive={true}
          />
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Main Chart Placeholder (Using pure CSS/Tailwind for preview) */}
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Revenue Growth
                </h3>
                <p className="text-sm text-gray-500">
                  Sales volume over the last 30 days
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-primary-500" />
            </div>

            <div className="h-64 flex items-end gap-2 px-4">
              {metrics.revenueByDay.slice(-15).map((day) => (
                <div key={day.date} className="flex-1 group relative">
                  <div
                    className="bg-primary-500/10 group-hover:bg-primary-500 rounded-t-lg transition-all duration-300"
                    style={{
                      height: `${Math.max(10, (day.revenue / (Math.max(...metrics.revenueByDay.map((d) => d.revenue)) || 1)) * 100)}%`,
                    }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ৳{day.revenue.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between text-[10px] text-gray-400 font-medium px-4">
              <span>30 Days Ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-full">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Efficiency Pulse
              </h3>
              <div className="space-y-8">
                <PulseMetric
                  label="Bid Velocity"
                  description="Avg bids/hour"
                  value={metrics.bidVelocity}
                  color="blue"
                />
                <PulseMetric
                  label="Liquidity Score"
                  description="Liveness of listings"
                  value={`${metrics.liquidityRate}%`}
                  color="emerald"
                />
                <PulseMetric
                  label="Avg. Sale"
                  description="Unit value"
                  value={`৳${metrics.avgSalePrice.toLocaleString()}`}
                  color="purple"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Global Competitiveness */}
        <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-primary-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 blur-[100px]" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-5 h-5 text-primary-400" />
                <span className="text-primary-400 font-bold tracking-widest text-sm uppercase">
                  Giant Slayer Tier
                </span>
              </div>
              <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6 leading-tight">
                Your performance is in the top 5% of sellers.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                You are currently outperforming standard marketplace average
                benchmarks. Enable &quot;Pro Scaling&quot; to unlock wholesale
                features.
              </p>
              <button className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-primary-50 transition-all flex items-center gap-3 active:scale-95 shadow-xl shadow-white/10">
                Unlock Elite Tools{" "}
                <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6 w-full md:w-auto">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center">
                <div className="text-primary-400 text-3xl font-bold mb-1">
                  98.2
                </div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-widest">
                  Trust Index
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center">
                <div className="text-amber-400 text-3xl font-bold mb-1">
                  Elite
                </div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-widest">
                  Badge Tier
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center">
                <div className="text-emerald-400 text-3xl font-bold mb-1">
                  Fast
                </div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-widest">
                  Shipping Pulse
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-center">
                <div className="text-blue-400 text-3xl font-bold mb-1">
                  Scale
                </div>
                <div className="text-gray-500 text-xs font-medium uppercase tracking-widest">
                  Alibaba Ready
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  trend,
  isPositive,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  isPositive: boolean;
}) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-gray-50 rounded-2xl text-primary-600">
          {icon}
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {trend}
        </div>
      </div>
      <div>
        <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function PulseMetric({
  label,
  description,
  value,
  color,
}: {
  label: string;
  description: string;
  value: string | number;
  color: "blue" | "emerald" | "purple";
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
  };
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-gray-900">{label}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div
        className={`px-4 py-2 rounded-2xl border font-bold ${colors[color]}`}
      >
        {value}
      </div>
    </div>
  );
}
