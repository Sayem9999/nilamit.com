import { getRetailerStats } from "@/actions/retailer";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle,
  Package,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Plus,
  Eye,
  AlertCircle,
  Gavel,
  Shield,
  Star
} from "lucide-react";
import Link from "next/link";
import { formatBDT, formatTimeRemaining } from "@/lib/format";
import { db } from "@/lib/db";
import Image from "next/image";
import { getProxiedAvatarUrl } from "@/lib/avatar";

export const dynamic = "force-dynamic";

export default async function RetailerDashboardPage() {
  const session = await auth();
  const now = new Date();
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
      <div className="p-8 text-center pt-32">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold">Error loading stats</h1>
        <p className="text-gray-500">{statsRes.error?.message}</p>
      </div>
    );
  }

  const stats = statsRes.data!;

  // Fetch complete seller profile to get dynamic banner, bio & ratings
  const userSnap = await db.collection("users").doc(session.user.id).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  const seller = {
    name: session.user.name,
    image: session.user.image,
    isVerifiedSeller: session.user.isVerifiedSeller,
    isRetailer: session.user.isRetailer,
    isTopRated: session.user.isTopRated,
    rating: session.user.rating || 98,
    ratingCount: userData?.ratingCount || 140,
    salesCount: userData?.salesCount || 12,
    defectCount: userData?.defectCount || 0,
    banner: userData?.banner || null,
    bio: userData?.bio || "",
    createdAt: userData?.createdAt || new Date(),
  };

  // Fetch active C2C listings from this merchant
  const auctionsSnap = await db.collection("auctions")
    .where("sellerId", "==", session.user.id)
    .where("status", "==", "ACTIVE")
    .limit(5)
    .get();

  const activeAuctions = auctionsSnap.docs.map(doc => {
    const data = doc.data();
    let end: Date;
    if (data.endTime && typeof data.endTime.toDate === 'function') {
      end = data.endTime.toDate();
    } else {
      end = new Date(data.endTime || now);
    }
    return {
      id: doc.id,
      title: data.title || "",
      startingPrice: Number(data.startingPrice || 0),
      currentPrice: Number(data.currentPrice || data.startingPrice || 0),
      images: Array.isArray(data.images) ? data.images : [],
      endTime: end,
      timeLeft: formatTimeRemaining(end, now),
      category: data.category || "",
      bidCount: Number(data.bidCount || 0)
    };
  }).sort((a, b) => a.endTime.getTime() - b.endTime.getTime());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pt-36 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* 1. Seller Identity Banner Widget */}
        <section aria-label="Seller Identity" className="mb-8 bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm relative">
          <div className="h-32 md:h-44 w-full bg-slate-100 overflow-hidden relative">
            {seller.banner ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={seller.banner}
                alt="Storefront Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-primary-600 via-indigo-650 to-indigo-800" />
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              </>
            )}
          </div>

          <div className="px-6 md:px-8 pb-6 relative flex flex-col md:flex-row items-center md:items-end justify-between gap-6 -mt-10 md:-mt-16">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl bg-white p-1.5 shadow-xl relative z-10 ring-4 ring-white">
                <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative border border-slate-100">
                  {seller.image ? (
                    <Image
                      src={getProxiedAvatarUrl(seller.image) || ""}
                      alt={seller.name || "Seller"}
                      fill
                      sizes="(max-width: 768px) 80px, 112px"
                      className="object-cover"
                      referrerPolicy="no-referrer"
                      unoptimized
                    />
                  ) : (
                    <span className="text-3xl font-black text-slate-300">{(seller.name || "?")[0]}</span>
                  )}
                </div>
              </div>

              <div className="md:mb-2">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1.5">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 font-heading">
                    {seller.name}
                  </h1>
                  
                  {seller.isRetailer && (
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-700">
                      Pro Retailer
                    </span>
                  )}
                  {seller.isVerifiedSeller && (
                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-700 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" /> Verified
                    </span>
                  )}
                </div>
                
                <p className="text-slate-500 text-xs font-medium max-w-xl line-clamp-1 mb-1">
                  {seller.bio || `Welcome to your C2C Marketplace console. Managing active sales and trust metrics.`}
                </p>

                <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black uppercase tracking-wide text-slate-400">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <strong className="text-slate-700">{seller.rating}% Positive Feedback</strong> ({seller.ratingCount} reviews)
                  </span>
                  <span>·</span>
                  <span className="text-slate-500">
                    Volume: <strong className="text-slate-700">{seller.salesCount} sold</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 md:mb-2">
              <Link 
                href={`/seller/${session.user.id}`}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                View Storefront
              </Link>
              <Link 
                href="/auctions/create"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-650/15 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Listing
              </Link>
            </div>
          </div>
        </section>

        {/* 2. C2C Operational Action Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ActionCard 
            title="Awaiting Shipment" 
            value={stats.pendingDeliveries.toString()} 
            subValue="Process labels & ship"
            icon={<ShoppingBag className="w-5 h-5 text-amber-600" />}
            badge={stats.pendingDeliveries > 0 ? "Action Required" : "All Clear"}
            badgeType={stats.pendingDeliveries > 0 ? "warning" : "success"}
          />
          <ActionCard 
            title="Awaiting Payment" 
            value="1" 
            subValue="Bids won, waiting checkout"
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
            badge="Pending"
            badgeType="warning"
          />
          <ActionCard 
            title="Active Auctions" 
            value={stats.activeListings.toString()} 
            subValue="Bids actively receiving"
            icon={<Gavel className="w-5 h-5 text-indigo-600" />}
            badge="Live"
            badgeType="info"
          />
          <ActionCard 
            title="Open Disputes" 
            value={stats.disputeRate > 0 ? "1" : "0"} 
            subValue="Buyer claim resolutions"
            icon={<ShieldCheck className="w-5 h-5 text-red-600" />}
            badge={stats.disputeRate > 0 ? "Needs Review" : "No Claims"}
            badgeType={stats.disputeRate > 0 ? "danger" : "success"}
          />
        </div>

        {/* 3. Split Grid Layout (Live Feed vs. Task Board) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (2/3 width) - Live Active C2C Auctions */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg md:text-xl font-heading font-semibold text-slate-900">Live Active Listings</h2>
                <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mt-0.5">Real-time marketplace feedback</p>
              </div>
              <Link 
                href="/dashboard?tab=listings" 
                className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-850 flex items-center gap-1"
              >
                Manage all ({stats.activeListings}) <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex-1 space-y-4">
              {activeAuctions.length > 0 ? (
                activeAuctions.map((auction) => (
                  <div 
                    key={auction.id} 
                    className="p-4 bg-slate-50 border border-slate-100/70 hover:border-slate-200 rounded-2xl transition-all flex items-center gap-4 hover:shadow-sm"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 relative border border-slate-200/50 flex-shrink-0">
                      {auction.images && auction.images[0] ? (
                        <Image
                          src={auction.images[0]}
                          alt={auction.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-400 text-[8px] font-black uppercase tracking-wider rounded-md">
                          {auction.category}
                        </span>
                        <span className="text-[9px] font-black text-indigo-650 uppercase tracking-widest flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-650" />
                          {auction.timeLeft}
                        </span>
                      </div>
                      <Link 
                        href={`/auctions/${auction.id}`}
                        className="text-xs md:text-sm font-bold text-slate-800 hover:text-indigo-650 transition-colors truncate block"
                      >
                        {auction.title}
                      </Link>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-0.5">Current Bid</p>
                      <p className="text-sm md:text-base font-black text-slate-900">{formatBDT(auction.currentPrice)}</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Gavel className="w-10 h-10 text-slate-400 mb-3" />
                  <p className="text-xs font-bold text-slate-800 mb-1">No active auctions</p>
                  <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed font-medium mx-auto mb-4">
                    List a consumer item now and get immediate feedback with real-time bidding alerts!
                  </p>
                  <Link 
                    href="/auctions/create"
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                  >
                    Create Auction
                  </Link>
                </div>
              )}
            </div>

            {/* Micro Sales Analytics Summary (Compact footer summary instead of a huge chart) */}
            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap justify-between items-center gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex gap-4">
                <span>Completed Sales: <strong className="text-slate-800">{stats.totalSales}</strong></span>
                <span>Success Rate: <strong className="text-slate-800">{stats.sellThroughRate.toFixed(1)}%</strong></span>
              </div>
              <span className="text-emerald-600 flex items-center gap-1 font-black">
                <TrendingUp className="w-3.5 h-3.5" /> Gross sales: {formatBDT(stats.grossVolume)}
              </span>
            </div>
          </div>

          {/* Right Column (1/3 width) - Action Board & Shop Health */}
          <div className="space-y-6">
            
            {/* Operational Action Board */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm text-slate-800">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-5 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-indigo-500" />
                  Operations Action Board
                </span>
                <span className="text-[8px] font-black text-indigo-650 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase">
                  Tasks Pending
                </span>
              </h3>

              <div className="space-y-4">
                {stats.pendingDeliveries > 0 ? (
                  <AlertItem 
                    title="Orders Awaiting Shipment" 
                    desc={`You have ${stats.pendingDeliveries} paid order(s) waiting for packaging and carrier dispatch.`}
                    type="warning"
                    href="/retailer/orders"
                  />
                ) : (
                  <div className="p-4 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-2xl text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-emerald-700 mb-0.5">All Orders Shipped!</h4>
                    <p className="text-[9px] text-slate-400 font-medium max-w-[190px] mx-auto">No outstanding shipping orders on the ledger.</p>
                  </div>
                )}

                {stats.disputeRate > 0 && (
                  <AlertItem 
                    title="Active Disputes Center Case" 
                    desc="Damaged box case unresolved. Review buyer comments within 24h to avoid automated escalations."
                    type="danger"
                    href="/retailer/disputes"
                  />
                )}

                <AlertItem 
                  title="Bulk Catalog Template Sync" 
                  desc="Sync up to 50 active listings instantaneously via CSV file."
                  type="success"
                  href="/seller/inventory/bulk"
                />
              </div>
            </div>

            {/* Shop Health & Standing */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2rem] p-8 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-indigo-200">Shop Health Standing</h3>
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                
                <p className="text-slate-300 text-xs mb-6 font-medium leading-relaxed">
                  Keep standard dispatch times fast and ratings positive to qualify for the <strong className="text-white">Top Rated Seller</strong> badge.
                </p>
                
                <div className="space-y-4 mb-6">
                  <MetricProgress label="Dispatch Speed" value={98} />
                  <MetricProgress label="Buyer Satisfaction" value={92} />
                  <MetricProgress label="Listing Accuracy" value={85} />
                </div>

                <Link 
                  href="/retailer/perks"
                  className="block text-center py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all focus:outline-none"
                >
                  View Tiers & Perks
                </Link>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

function ActionCard({ title, value, subValue, icon, badge, badgeType }: {
  title: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  badge: string;
  badgeType: 'success' | 'warning' | 'danger' | 'info';
}) {
  const badgeStyles = {
    success: "bg-emerald-50 border-emerald-100 text-emerald-600",
    warning: "bg-amber-50 border-amber-100 text-amber-600",
    danger: "bg-red-50 border-red-100 text-red-600",
    info: "bg-indigo-50 border-indigo-100 text-indigo-650",
  };

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[1.5rem] hover:border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeStyles[badgeType]}`}>
          {badge}
        </span>
      </div>
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{title}</h3>
        <p className="text-2xl font-black text-slate-900 mb-0.5">{value}</p>
        <p className="text-[10px] text-slate-400 font-medium">{subValue}</p>
      </div>
    </div>
  );
}

function MetricProgress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">{label}</span>
        <span className="text-[9px] font-black text-indigo-300">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function AlertItem({ title, desc, type, href }: { title: string; desc: string; type: 'success' | 'warning' | 'danger'; href: string }) {
  const styles = {
    success: "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/20",
    warning: "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100/20",
    danger: "bg-red-50 border-red-100 text-red-700 hover:bg-red-100/20",
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce-subtle" />,
    danger: <AlertTriangle className="w-4 h-4 text-red-600" />,
  };

  return (
    <Link 
      href={href}
      className={`p-4 rounded-2xl border ${styles[type]} flex gap-3 transition-colors duration-150 block`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-black uppercase mb-1 leading-none flex items-center justify-between gap-1.5">
          {title}
          <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        </h4>
        <p className="text-[10px] opacity-80 leading-relaxed font-medium">{desc}</p>
      </div>
    </Link>
  );
}
