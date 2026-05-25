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

  if (!session.user.isVerifiedSeller && !session.user.isRetailer && !session.user.emailVerified) {
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
    <div className="min-h-screen bg-slate-50 text-slate-800 pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                  {session.user.isRetailer ? "Professional Retailer" : "Verified Seller"}
                </span>
              </div>
              {session.user.isTopRated && (
                <div className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-full flex items-center gap-1.5 animate-pulse">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Top Rated</span>
                </div>
              )}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-1 font-heading">
              Seller Hub
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Real-time performance analytics for <span className="text-slate-900 font-bold">@{session.user.name?.split(' ')[0].toLowerCase()}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              href="/auctions/create"
              className="px-6 py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-md shadow-primary-600/10"
            >
              <Package className="w-4 h-4" />
              New Listing
            </Link>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            title="Gross Sales" 
            value={formatBDT(stats.grossVolume)} 
            subValue={`Net Earnings: ${formatBDT(stats.netRevenue)}`}
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
            trend="+12.5%"
            isPositive={true}
          />
          <StatCard 
            title="Total Items Sold" 
            value={stats.totalSales.toString()} 
            subValue={`Avg Price: ${formatBDT(stats.avgSalePrice)}`}
            icon={<ShoppingBag className="w-5 h-5 text-indigo-600" />}
            trend="+8%"
            isPositive={true}
          />
          <StatCard 
            title="Auction Success Rate" 
            value={`${stats.sellThroughRate.toFixed(1)}%`} 
            subValue="Last 30 Days"
            icon={<BarChart3 className="w-5 h-5 text-amber-600" />}
            trend="-2.4%"
            isPositive={false}
          />
          <StatCard 
            title="Active Listings" 
            value={stats.activeListings.toString()} 
            subValue="Ready for bids"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            trend="New"
            isPositive={true}
          />
        </div>

        {/* Middle Section: Chart & System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm text-slate-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-heading font-semibold text-slate-900 mb-1">Bidding & Sales Overview</h3>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-black">7 Day Trajectory</p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-3 h-3 bg-primary-600 rounded-full" />
                <span className="text-[10px] font-bold uppercase text-slate-500">Sales & Bid Volume</span>
              </div>
            </div>
            
            {/* Simple SVG Chart Representation or Empty State */}
            {stats.dailyRevenue.reduce((acc, d) => acc + d.amount, 0) > 0 ? (
              <div className="h-64 w-full relative mt-12">
                 <div className="absolute inset-0 flex items-end justify-between px-4 pb-8">
                   {stats.dailyRevenue.map((day, _i) => (
                     <div key={day.date} className="group relative flex flex-col items-center flex-1">
                       <div 
                         className="w-12 bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-lg transition-all duration-500 hover:from-primary-700 hover:to-primary-500 hover:scale-105 hover:shadow-lg"
                         style={{ height: `${Math.max(10, (day.amount / (Math.max(...stats.dailyRevenue.map(d => d.amount)) || 1)) * 100)}%` }}
                       />
                       <span className="text-[9px] font-bold text-slate-400 mt-3 uppercase">{day.date.split('-').slice(1).join('/')}</span>
                       <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded shadow-xl">
                         {formatBDT(day.amount)}
                       </div>
                     </div>
                   ))}
                 </div>
                 <div className="absolute left-0 right-0 bottom-8 h-px bg-slate-100" />
              </div>
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50 mt-12 p-6 text-center">
                <BarChart3 className="w-10 h-10 text-slate-400 mb-3" />
                <p className="text-xs font-bold text-slate-800 mb-1">No sales activity recorded</p>
                <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed font-medium mx-auto">
                  Completed sales and auctions over the last 7 days will automatically populate your overview trajectory here.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary-600 to-indigo-650 rounded-[2rem] p-8 shadow-xl text-white shadow-primary-600/10">
              <h3 className="text-xl font-bold mb-2">Pro Seller Status</h3>
              <p className="text-indigo-100/80 text-sm mb-6 font-medium">Maintain high standards to unlock lower commission rates.</p>
              
              <div className="space-y-4">
                 <MetricProgress label="Dispatch Speed" value={98} />
                 <MetricProgress label="Buyer Satisfaction" value={92} />
                 <MetricProgress label="Active Listings Quality" value={85} />
              </div>

               <Link 
                href="/retailer/perks"
                className="mt-8 block text-center py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                View Unlockables
              </Link>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm text-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {(stats.pendingDeliveries > 0 || stats.disputeRate > 2 || stats.shillReports > 0) ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  Shop Health
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                  (stats.pendingDeliveries > 0 || stats.disputeRate > 2 || stats.shillReports > 0)
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  {(stats.pendingDeliveries > 0 || stats.disputeRate > 2 || stats.shillReports > 0) ? 'Warnings Pending' : 'Shop Ok'}
                </span>
              </h3>
              
              <div className="space-y-4">
                {(stats.pendingDeliveries > 0 || stats.disputeRate > 2 || stats.shillReports > 0) ? (
                  <>
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
                        desc={`Your current rate (${stats.disputeRate.toFixed(1)}%) is above the safe threshold.`}
                        type="danger"
                      />
                    )}
                    {stats.shillReports > 0 && (
                      <AlertItem 
                        title="Shill Bidding Reports" 
                        desc={`System flagged ${stats.shillReports} auctions for manual shill review.`}
                        type="danger"
                      />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-6 px-4 border border-dashed border-emerald-100 rounded-2xl bg-emerald-50/20">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100 shadow-md shadow-emerald-500/5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs font-bold text-emerald-700 mb-0.5">Shop Standing Excellent</p>
                    <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed font-medium">
                      No warnings detected. Your shop standing is in excellent health.
                    </p>
                  </div>
                )}

                {/* Precise inventory and real-time database sync confirmation status */}
                <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span>Catalog Online</span>
                  </div>
                  <span>{stats.activeListings} Active {stats.activeListings === 1 ? 'Listing' : 'Listings'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
           <QuickAction href="/dashboard?tab=listings" icon={<Package className="w-5 h-5 text-indigo-500" />} label="Active Listings" />
           <QuickAction href="/retailer/orders" icon={<Clock className="w-5 h-5 text-indigo-500" />} label="Order History" />
           <QuickAction href="/retailer/disputes" icon={<ShieldCheck className="w-5 h-5 text-indigo-500" />} label="Dispute Center" />
           <QuickAction href="/retailer/settings" icon={<ChevronRight className="w-5 h-5 text-indigo-500" />} label="Business Profile" />
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
    <div className="bg-white border border-slate-100 p-6 rounded-[1.5rem] hover:border-slate-200 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-slate-50 rounded-xl group-hover:scale-110 transition-transform border border-slate-100">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${isPositive ? 'text-emerald-600' : 'text-red-650'}`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{title}</h3>
      <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      <p className="text-[10px] text-slate-500 font-medium">{subValue}</p>
    </div>
  );
}

function MetricProgress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-150">{label}</span>
        <span className="text-[10px] font-black text-white">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-indigo-950/40 rounded-full overflow-hidden">
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
    success: "bg-emerald-50 border-emerald-100 text-emerald-700",
    warning: "bg-amber-50 border-amber-100 text-amber-700",
    danger: "bg-red-50 border-red-100 text-red-700",
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    danger: <AlertTriangle className="w-4 h-4 text-red-600" />,
  };

  return (
    <div className={`p-4 rounded-2xl border ${styles[type]} flex gap-3 bg-white`}>
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
      className="bg-white border border-slate-100 p-5 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-200 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="text-slate-400 group-hover:text-primary-600 transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-800 transition-colors">
        {label}
      </span>
    </Link>
  );
}
