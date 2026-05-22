import { getRetailerStats } from "@/actions/retailer";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  BarChart3, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { formatBDT } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RetailerDashboardPage() {
  const session = await auth();
  const _t = await getTranslations("Dashboard");

  if (!session?.user) {
    redirect("/login?callbackUrl=/retailer/dashboard");
  }

  if (!session.user.isVerifiedSeller && !session.user.isRetailer) {
    redirect("/dashboard");
  }

  const statsRes = await getRetailerStats();
  if (!statsRes.success) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold">Error loading stats</h1>
        <p className="text-gray-500">{statsRes.error?.message}</p>
      </div>
    );
  }

  const stats = statsRes.data!;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  {session.user.isRetailer ? "Professional Retailer" : "Verified Seller"}
                </span>
              </div>
              {session.user.isTopRated && (
                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Top Rated</span>
                </div>
              )}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-1">
              Command Center
            </h1>
            <p className="text-gray-400 text-sm font-medium">
              Real-time performance analytics for <span className="text-white">@{session.user.name?.split(' ')[0].toLowerCase()}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/auctions/create"
              className="px-6 py-3 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-xl shadow-white/5"
            >
              <Package className="w-4 h-4" />
              New Listing
            </Link>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Gross Merchandise Value" 
            value={formatBDT(stats.grossVolume)} 
            subValue={`Net: ${formatBDT(stats.netRevenue)}`}
            icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
            trend="+12.5%"
            isPositive={true}
          />
          <StatCard 
            title="Total Items Sold" 
            value={stats.totalSales.toString()} 
            subValue={`Avg Price: ${formatBDT(stats.avgSalePrice)}`}
            icon={<ShoppingBag className="w-5 h-5 text-indigo-400" />}
            trend="+8%"
            isPositive={true}
          />
          <StatCard 
            title="Sell-Through Rate" 
            value={`${stats.sellThroughRate.toFixed(1)}%`} 
            subValue="Last 30 Days"
            icon={<BarChart3 className="w-5 h-5 text-amber-400" />}
            trend="-2.4%"
            isPositive={false}
          />
          <StatCard 
            title="Active Listings" 
            value={stats.activeListings.toString()} 
            subValue="Ready for bids"
            icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            trend="New"
            isPositive={true}
          />
        </div>

        {/* Middle Section: Chart & Operational Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-[#141417] border border-white/5 rounded-[2rem] p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Revenue Overview</h3>
                <p className="text-gray-500 text-xs uppercase tracking-widest font-black">7 Day Trajectory</p>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                <span className="text-[10px] font-bold uppercase text-gray-400">Sales Volume</span>
              </div>
            </div>
            
            {/* Simple SVG Chart Representation */}
            <div className="h-64 w-full relative mt-12">
               <div className="absolute inset-0 flex items-end justify-between px-4 pb-8">
                 {stats.dailyRevenue.map((day, _i) => (
                   <div key={day.date} className="group relative flex flex-col items-center flex-1">
                     <div 
                       className="w-12 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20"
                       style={{ height: `${Math.max(10, (day.amount / (Math.max(...stats.dailyRevenue.map(d => d.amount)) || 1)) * 100)}%` }}
                     />
                     <span className="text-[9px] font-bold text-gray-500 mt-3 uppercase">{day.date.split('-').slice(1).join('/')}</span>
                     <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-white text-black text-[10px] font-black px-2 py-1 rounded shadow-xl">
                       {formatBDT(day.amount)}
                     </div>
                   </div>
                 ))}
               </div>
               <div className="absolute left-0 right-0 bottom-8 h-px bg-white/5" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-8 shadow-2xl shadow-indigo-500/20">
              <h3 className="text-xl font-bold mb-2">Pro Seller Status</h3>
              <p className="text-indigo-100/60 text-sm mb-6 font-medium">Maintain high standards to unlock lower commission rates.</p>
              
              <div className="space-y-4">
                 <MetricProgress label="Fulfillment Speed" value={98} />
                 <MetricProgress label="Buyer Satisfaction" value={92} />
                 <MetricProgress label="Inventory Health" value={85} />
              </div>

              <Link 
                href="/retailer/perks"
                className="mt-8 block text-center py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                View Unlockables
              </Link>
            </div>

            <div className="bg-[#141417] border border-white/5 rounded-[2rem] p-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Operational Alerts
              </h3>
              
              <div className="space-y-4">
                {stats.pendingDeliveries > 0 && (
                  <AlertItem 
                    title={`${stats.pendingDeliveries} Pending Shipments`} 
                    desc="Process these within 24h to maintain Top Rated status."
                    type="warning"
                  />
                )}
                {stats.disputeRate > 2 && (
                  <AlertItem 
                    title="Elevated Dispute Rate" 
                    desc="Your current rate (3.2%) is above the safe threshold."
                    type="danger"
                  />
                )}
                {stats.shillReports > 0 && (
                  <AlertItem 
                    title="Shill Bidding Reports" 
                    desc="System flagged 2 auctions for manual shill review."
                    type="danger"
                  />
                )}
                <AlertItem 
                  title="Inventory Sync Complete" 
                  desc="All 48 SKU nodes synchronized with RTDB."
                  type="success"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
           <QuickAction href="/dashboard?tab=listings" icon={<Package />} label="Active Listings" />
           <QuickAction href="/retailer/orders" icon={<Clock />} label="Order History" />
           <QuickAction href="/retailer/disputes" icon={<ShieldCheck />} label="Dispute Center" />
           <QuickAction href="/retailer/settings" icon={<ChevronRight />} label="Business Profile" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subValue, icon, trend, isPositive }: {
  title: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  trend: string;
  isPositive: boolean;
}) {
  return (
    <div className="bg-[#141417] border border-white/5 p-6 rounded-[1.5rem] hover:border-white/10 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white/5 rounded-xl group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{title}</h3>
      <p className="text-2xl font-black text-white mb-1">{value}</p>
      <p className="text-[10px] text-gray-400 font-medium">{subValue}</p>
    </div>
  );
}

function MetricProgress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-100">{label}</span>
        <span className="text-[10px] font-black text-white">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-indigo-900/50 rounded-full overflow-hidden">
        <div 
          className="h-full bg-white rounded-full transition-all duration-1000"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function AlertItem({ title, desc, type }: { title: string; desc: string; type: 'success' | 'warning' | 'danger' }) {
  const styles = {
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    danger: "bg-red-500/10 border-red-500/20 text-red-400",
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    danger: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <div className={`p-4 rounded-2xl border ${styles[type]} flex gap-3`}>
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <div>
        <h4 className="text-xs font-black uppercase mb-1 leading-none">{title}</h4>
        <p className="text-[10px] opacity-80 leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href}
      className="bg-[#141417] border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-[#1a1a1e] hover:border-white/10 transition-all group"
    >
      <div className="text-gray-400 group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-300">
        {label}
      </span>
    </Link>
  );
}
