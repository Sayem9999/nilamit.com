import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import AuctionCard from "@/components/auction/AuctionCard";
import { 
  Package, Star, Store, ArrowRight,
  MessageSquare, CheckCircle,
  Heart, RefreshCw, LogOut, Bell,
  ChevronRight, Trophy, Shield, BarChart3,
  TrendingUp, DollarSign, ShoppingBag, AlertTriangle,
  Clock, ShieldCheck, CheckCircle2, Plus, Eye, AlertCircle, Gavel
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { AuctionWithSeller } from "@/types";
import { formatBDT, formatTimeRemaining } from "@/lib/format";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/actions/admin-content";
import { EscrowService } from "@/services/finance/escrow-service";
import { CoordinationService } from "@/services/social/coordination-service";
import { HydratedEscrowTransaction, CoordinationHubItem } from "@/types";
import { NotificationsList } from "@/components/social/NotificationsList";
import type { Session } from "next-auth";
import { getRetailerStats } from "@/actions/retailer";
import { getProxiedAvatarUrl } from "@/lib/avatar";

export const dynamic = "force-dynamic";

type ListingFilter = "all" | "active" | "sold" | "expired" | "cancelled";
const VALID_LISTING_FILTERS: ListingFilter[] = ["all", "active", "sold", "expired", "cancelled"];

interface ListingStats {
  totalListings: number;
  active: number;
  sold: number;
  expired: number;
  cancelled: number;
  /** Net seller earnings = sum(currentPrice - commissionEarned) for SOLD listings. */
  netEarnings: number;
  /** Gross sales = sum(currentPrice) for SOLD listings. */
  grossSales: number;
  /** Total platform commission paid across all SOLD listings. */
  totalCommission: number;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; mode?: string }>;
}) {
  let session = await auth();
  if (process.env.NODE_ENV === "development" && !session?.user) {
    session = {
      user: {
        id: "mock-user-id",
        name: "SAYEM SARKAR",
        email: "sayem@example.com",
        image: null,
        isVerifiedSeller: true,
        reputationScore: 0,
        rating: 3.5,
        ratingCount: 5,
        isAdmin: false,
        isBanned: false,
        userLevel: 1,
        xp: 0,
        winningStreak: 0,
        emailVerified: null,
        isRetailer: false,
        isTopRated: false,
        salesCount: 1,
        defectCount: 0,
      }
    } as Session;
  }
  const t = await getTranslations("Dashboard");
  const te = await getTranslations("Escrow");
  const tStats = await getTranslations("ListingStats");

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const userId = session.user.id;

  // Pre-fetch count stats for the sidebar to provide high-fidelity UX badges
  const [
    listingsCountSnap,
    watchlistCountSnap,
    bidsCountSnap,
    escrowCountSnap,
    buyerConvCountSnap,
    sellerConvCountSnap,
  ] = await Promise.all([
    db.collection("auctions").where("sellerId", "==", userId).count().get(),
    db.collection("watchlist").where("userId", "==", userId).count().get(),
    db.collection("bids").where("bidderId", "==", userId).count().get(),
    db.collection("escrowTransactions").where("buyerId", "==", userId).count().get(),
    db.collection("conversations").where("buyerId", "==", userId).count().get(),
    db.collection("conversations").where("sellerId", "==", userId).count().get(),
  ]);
  const totalListingsCount = listingsCountSnap.data().count;
  const watchlistCount = watchlistCountSnap.data().count;
  const bidsCount = bidsCountSnap.data().count;
  const escrowCount = escrowCountSnap.data().count;
  const chatsCount = buyerConvCountSnap.data().count + sellerConvCountSnap.data().count;

  const configRes = await getSystemConfig();
  const configFromDb = configRes.success ? configRes.data : null;

  const systemConfig = {
    heroTitle: configFromDb?.heroTitle || t("heroTitle"),
    heroSubtitle: configFromDb?.heroSubtitle || t("heroSubtitle"),
    heroImage: configFromDb?.heroImage || null,
    announcement: configFromDb?.announcement || null,
    showAnnouncement: configFromDb?.showAnnouncement || false,
    treasuryBkash: configFromDb?.treasuryBkash || "017XXXXXXXX",
    treasuryNagad: configFromDb?.treasuryNagad || "018XXXXXXXX",
  };

  const { tab, status: rawStatus, mode } = await searchParams;
  const currentTab = tab || "watchlist";
  const listingFilter: ListingFilter = (VALID_LISTING_FILTERS.includes(rawStatus as ListingFilter) ? rawStatus : "all") as ListingFilter;
  const isSellerMode = mode === "seller" && (session.user.isVerifiedSeller || session.user.isRetailer || session.user.emailVerified);

  if (isSellerMode) {
    const statsRes = await getRetailerStats();
    if (!statsRes.success) {
      return (
        <div className="min-h-screen bg-gray-50 pt-36 pb-12 px-4 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold">Error loading stats</h1>
          <p className="text-gray-500">{statsRes.error?.message}</p>
        </div>
      );
    }
    const stats = statsRes.data!;
    
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : null;

    const seller = {
      name: session.user.name,
      image: session.user.image,
      isVerifiedSeller: session.user.isVerifiedSeller,
      isRetailer: session.user.isRetailer,
      isTopRated: session.user.isTopRated,
      rating: userData?.rating ?? session.user.rating ?? 0,
      ratingCount: userData?.ratingCount ?? session.user.ratingCount ?? 0,
      salesCount: stats.totalSales,
      defectCount: userData?.defectCount ?? 0,
      banner: userData?.banner || null,
      bio: userData?.bio || "",
      createdAt: userData?.createdAt || new Date(),
    };

    const hasReviews = seller.ratingCount > 0;
    const feedbackPercentage = hasReviews && seller.rating
      ? Math.min(100, Math.round((seller.rating / 5) * 100))
      : null;

    // Fetch active C2C listings from this merchant
    const now = new Date();
    const auctionsSnap = await db.collection("auctions")
      .where("sellerId", "==", userId)
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
      <div className="min-h-screen bg-slate-50 text-slate-800 pt-36 pb-12 px-4 sm:px-6 lg:px-8 font-sans animate-in fade-in duration-300">
        <div className="max-w-7xl mx-auto">
          
          {/* Mode Switcher Bar */}
          <div className="mb-6 bg-white border border-slate-200/80 rounded-[1.5rem] p-3.5 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 pl-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-650 animate-pulse" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Dashboard</p>
                <p className="text-xs font-bold text-slate-800">
                  Professional Merchant Console (Seller Hub)
                </p>
              </div>
            </div>
            <Link
              href="/dashboard?mode=buyer"
              className="px-5 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
            >
              Switch to Buyer Mode
            </Link>
          </div>

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
                    {hasReviews && feedbackPercentage !== null ? (
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <strong className="text-slate-700">{feedbackPercentage}% Positive Feedback</strong> ({seller.ratingCount} {seller.ratingCount === 1 ? 'review' : 'reviews'})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-slate-300" />
                        <strong className="text-slate-500">No feedback received yet</strong>
                      </span>
                    )}
                    <span>·</span>
                    <span className="text-slate-500">
                      Volume: <strong className="text-slate-700">{seller.salesCount} sold</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 md:mb-2">
                <Link 
                  href={`/seller/${userId}`}
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
              value={stats.awaitingPayment.toString()} 
              subValue="Bids won, waiting checkout"
              icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
              badge={stats.awaitingPayment > 0 ? "Pending" : "All Clear"}
              badgeType={stats.awaitingPayment > 0 ? "warning" : "success"}
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
              value={stats.openDisputes.toString()} 
              subValue="Buyer claim resolutions"
              icon={<ShieldCheck className="w-5 h-5 text-red-600" />}
              badge={stats.openDisputes > 0 ? "Needs Review" : "No Claims"}
              badgeType={stats.openDisputes > 0 ? "danger" : "success"}
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

              {/* Micro Sales Analytics Summary */}
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
                  {(seller.defectCount > 0 || (seller.defectCount / (seller.salesCount + seller.defectCount || 1)) > 0.03) && (
                    <AlertItem 
                      title="Seller Defect Alert" 
                      desc={`Your transaction defect rate is currently ${((seller.defectCount / (seller.salesCount + seller.defectCount || 1)) * 100).toFixed(1)}% (${seller.defectCount} defect(s)). Keep it below 5% to avoid account suspension.`}
                      type="danger"
                      href="/profile"
                    />
                  )}

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

                  {stats.openDisputes > 0 && (
                    <AlertItem 
                      title="Active Disputes Center Case" 
                      desc="You have unresolved escrow dispute cases. Review comments immediately to prevent automatic escalation."
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

  // userId pre-declared at the top for badge queries

  // Fetch relevant data based on tab
  let watchlistAuctions: AuctionWithSeller[] = [];
  let myListings: AuctionWithSeller[] = [];
  const listingStats: ListingStats = {
    totalListings: 0, active: 0, sold: 0, expired: 0, cancelled: 0,
    netEarnings: 0, grossSales: 0, totalCommission: 0,
  };
  let activeBids: AuctionWithSeller[] = [];
  let escrowTransactions: HydratedEscrowTransaction[] = [];
  let coordinationItems: CoordinationHubItem[] = [];

  // ─── LISTINGS ──────────────────────────────────────────────────────────────
  if (currentTab === "listings") {
    const rawSnap = await db.collection('auctions')
      .where('sellerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    if (!rawSnap.empty) {
      const auctionIds = rawSnap.docs.map(d => d.id);

      // Seller is always the current user — fetch once, not per-auction
      const [sellerSnap, bidCountSnaps] = await Promise.all([
        db.collection('users').doc(userId).get(),
        Promise.all(auctionIds.map(id =>
          db.collection('bids').where('auctionId', '==', id).count().get()
        )),
      ]);
      const seller = sellerSnap.data() ?? {};
      const bidCountMap = new Map(auctionIds.map((id, i) => [id, bidCountSnaps[i].data().count]));

      const allListings = rawSnap.docs.map(d => {
        const a = d.data();
        return {
          ...a, id: d.id,
          createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
          endTime:   a.endTime?.toDate?.()   || new Date(a.endTime),
          startTime: a.startTime?.toDate?.() || (a.startTime ? new Date(a.startTime) : undefined),
          updatedAt: a.updatedAt?.toDate?.() || (a.updatedAt ? new Date(a.updatedAt) : undefined),
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, rating: seller.rating, ratingCount: seller.ratingCount },
          _count: { bids: bidCountMap.get(d.id) ?? 0 },
          watchlist: [],
        };
      }) as unknown as AuctionWithSeller[];

      // Aggregate stats across ALL listings, regardless of UI filter, so the
      // header summary stays consistent as the user toggles tabs.
      for (const a of allListings) {
        listingStats.totalListings++;
        const status = (a.status as string) ?? "";
        if (status === "ACTIVE")    listingStats.active++;
        if (status === "SOLD" || status === "AWAITING_PAYMENT" || status === "OFFER_PENDING") {
          listingStats.sold++;
          const gross      = Number(a.currentPrice ?? 0);
          const commission = Number((a as { commissionEarned?: number }).commissionEarned ?? 0);
          listingStats.grossSales      += gross;
          listingStats.totalCommission += commission;
          listingStats.netEarnings     += Math.max(0, gross - commission);
        }
        if (status === "EXPIRED")   listingStats.expired++;
        if (status === "CANCELLED") listingStats.cancelled++;
      }

      // Apply user-selected status filter for rendering.
      const matches = (status: string): boolean => {
        if (listingFilter === "all")       return true;
        if (listingFilter === "active")    return status === "ACTIVE";
        if (listingFilter === "sold")      return status === "SOLD" || status === "AWAITING_PAYMENT" || status === "OFFER_PENDING";
        if (listingFilter === "expired")   return status === "EXPIRED";
        if (listingFilter === "cancelled") return status === "CANCELLED";
        return true;
      };
      myListings = allListings.filter(a => matches((a.status as string) ?? ""));
    }

  // ─── WATCHLIST ─────────────────────────────────────────────────────────────
  } else if (currentTab === "watchlist") {
    const watchSnap = await db.collection('watchlist').where('userId', '==', userId).get();

    if (!watchSnap.empty) {
      const watchDocs = watchSnap.docs.map(d => d.data());
      const auctionIds = [...new Set(watchDocs.map(w => w.auctionId as string))];

      // Pass 1: batch auctions + bid counts
      const [auctionSnaps, bidCountSnaps] = await Promise.all([
        db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id))),
        Promise.all(auctionIds.map(id =>
          db.collection('bids').where('auctionId', '==', id).count().get()
        )),
      ]);
      const auctionMap  = new Map(auctionSnaps.map(s => [s.id, s.exists ? s.data()! : null]));
      const bidCountMap = new Map(auctionIds.map((id, i) => [id, bidCountSnaps[i].data().count]));

      // Pass 2: batch sellers from auction data
      const sellerIds = [...new Set(auctionSnaps.map(s => s.data()?.sellerId).filter(Boolean) as string[])];
      const sellerSnaps = await db.getAll(...sellerIds.map(id => db.collection('users').doc(id)));
      const sellerMap = new Map(sellerSnaps.map(s => [s.id, s.data() ?? {}]));

      watchlistAuctions = watchDocs.map(w => {
        const a = auctionMap.get(w.auctionId);
        if (!a) return null;
        const seller = sellerMap.get(a.sellerId) ?? {};
        return {
          ...a, id: w.auctionId,
          createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
          endTime:   a.endTime?.toDate?.()   || new Date(a.endTime),
          startTime: a.startTime?.toDate?.() || (a.startTime ? new Date(a.startTime) : undefined),
          updatedAt: a.updatedAt?.toDate?.() || (a.updatedAt ? new Date(a.updatedAt) : undefined),
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, rating: seller.rating, ratingCount: seller.ratingCount },
          _count: { bids: bidCountMap.get(w.auctionId) ?? 0 },
          watchlist: [{
            ...w,
            createdAt: w.createdAt?.toDate?.() || (w.createdAt ? new Date(w.createdAt) : undefined),
          }],
        };
      }).filter(Boolean) as unknown as AuctionWithSeller[];
    }

  // ─── ACTIVE BIDS ───────────────────────────────────────────────────────────
  } else if (currentTab === "bids") {
    const bidsSnap = await db.collection('bids')
      .where('bidderId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const bidDocs = bidsSnap.docs.map(d => d.data());
    const uniqueAuctionIds = [...new Set(bidDocs.map(d => d.auctionId as string))];

    if (uniqueAuctionIds.length > 0) {
      // Pass 1: batch auctions
      const auctionSnaps = await db.getAll(...uniqueAuctionIds.map(id => db.collection('auctions').doc(id)));
      const auctionMap = new Map(auctionSnaps.map(s => [s.id, s.exists ? s.data()! : null]));

      // Count bids per auction from the already-fetched bids — no second DB call
      const bidCountMap = new Map<string, number>();
      bidDocs.forEach(b => bidCountMap.set(b.auctionId, (bidCountMap.get(b.auctionId) ?? 0) + 1));

      // Pass 2: batch sellers (only for ACTIVE auctions to minimise reads)
      const activeAuctionSnaps = auctionSnaps.filter(s => s.data()?.status === 'ACTIVE');
      const sellerIds = [...new Set(activeAuctionSnaps.map(s => s.data()?.sellerId).filter(Boolean) as string[])];
      const sellerMap = new Map<string, FirebaseFirestore.DocumentData>();
      if (sellerIds.length > 0) {
        const sellerSnaps = await db.getAll(...sellerIds.map(id => db.collection('users').doc(id)));
        sellerSnaps.forEach(s => sellerMap.set(s.id, s.data() ?? {}));
      }

      activeBids = uniqueAuctionIds.map(id => {
        const a = auctionMap.get(id);
        if (!a || a.status !== 'ACTIVE') return null;
        const seller = sellerMap.get(a.sellerId) ?? {};
        return {
          ...a, id,
          createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
          endTime:   a.endTime?.toDate?.()   || new Date(a.endTime),
          startTime: a.startTime?.toDate?.() || (a.startTime ? new Date(a.startTime) : undefined),
          updatedAt: a.updatedAt?.toDate?.() || (a.updatedAt ? new Date(a.updatedAt) : undefined),
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, rating: seller.rating, ratingCount: seller.ratingCount },
          _count: { bids: bidCountMap.get(id) ?? 0 },
          watchlist: [],
        };
      }).filter(Boolean) as unknown as AuctionWithSeller[];
    }

  // ─── ESCROW ────────────────────────────────────────────────────────────────
  } else if (currentTab === "escrow") {
    const res = await EscrowService.getBuyerEscrows(userId);
    if (res.success) {
      escrowTransactions = res.data ?? [];
    }

  // ─── COORDINATION HUB ──────────────────────────────────────────────────────
  } else if (currentTab === "coordination") {
    const res = await CoordinationService.getActiveCoordination(userId);
    if (res.success) {
      coordinationItems = res.data ?? [];
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-28 pb-12 animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Mode Switcher Bar */}
        {(session.user.isVerifiedSeller || session.user.isRetailer || session.user.emailVerified) && (
          <div className="mb-6 bg-white border border-slate-200/80 rounded-[1.5rem] p-3.5 shadow-sm flex items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 pl-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Dashboard</p>
                <p className="text-xs font-bold text-slate-800">
                  Personal C2C Dashboard
                </p>
              </div>
            </div>
            <Link
              href="/dashboard?mode=seller"
              className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 border-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-indigo-650/15"
            >
              Switch to Seller Mode
            </Link>
          </div>
        )}

        {/* System Announcement Sync */}
        {systemConfig.showAnnouncement && systemConfig.announcement && (
          <div className="mb-8 p-4 bg-primary-50 border border-primary-100 rounded-2xl flex items-center gap-3 text-primary-900 animate-in fade-in slide-in-from-top-4 duration-500">
            <CheckCircle className="w-5 h-5 text-primary-600" />
            <p className="font-semibold text-sm">{systemConfig.announcement}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar */}
          <div className="lg:col-span-1 w-full">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-6">
              
              {/* Buying Activities */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Buying</p>
                <div className="space-y-1">
                  <Link
                    href="/dashboard?tab=watchlist"
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border group ${
                      currentTab === "watchlist"
                        ? "bg-primary-50/80 text-primary-700 border-primary-200/50 pl-3 border-l-4 border-l-primary-600 scale-[1.01]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Heart className={`w-3.5 h-3.5 transition-colors ${
                        currentTab === "watchlist" ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                      }`} />
                      <span>{t("watchlist")}</span>
                    </div>
                    {watchlistCount > 0 ? (
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full transition-colors ${
                        currentTab === "watchlist" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {watchlistCount}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded">
                        0
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/dashboard?tab=bids"
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border group ${
                      currentTab === "bids"
                        ? "bg-primary-50/80 text-primary-700 border-primary-200/50 pl-3 border-l-4 border-l-primary-600 scale-[1.01]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className={`w-3.5 h-3.5 transition-colors ${
                        currentTab === "bids" ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                      }`} />
                      <span>{t("activeBids")}</span>
                    </div>
                    {bidsCount > 0 ? (
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full transition-colors ${
                        currentTab === "bids" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {bidsCount}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded">
                        0
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/dashboard?tab=escrow"
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border group ${
                      currentTab === "escrow"
                        ? "bg-primary-50/80 text-primary-700 border-primary-200/50 pl-3 border-l-4 border-l-primary-600 scale-[1.01]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle className={`w-3.5 h-3.5 transition-colors ${
                        currentTab === "escrow" ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                      }`} />
                      <span>{t("wonEscrow")}</span>
                    </div>
                    {escrowCount > 0 ? (
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full transition-colors ${
                        currentTab === "escrow" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {escrowCount}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded">
                        0
                      </span>
                    )}
                  </Link>
                </div>
              </div>

              {/* Selling Activities */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Selling</p>
                <div className="space-y-1">
                  <Link
                    href="/dashboard?tab=listings"
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border group ${
                      currentTab === "listings"
                        ? "bg-primary-50/80 text-primary-700 border-primary-200/50 pl-3 border-l-4 border-l-primary-600 scale-[1.01]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Store className={`w-3.5 h-3.5 transition-colors ${
                        currentTab === "listings" ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                      }`} />
                      <span>{t("myListings")}</span>
                    </div>
                    {totalListingsCount > 0 ? (
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full transition-colors ${
                        currentTab === "listings" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {totalListingsCount}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded">
                        0
                      </span>
                    )}
                  </Link>

                  {(session.user.isVerifiedSeller || session.user.isRetailer || session.user.emailVerified) && (
                    <>
                      <Link
                        href="/dashboard?mode=seller"
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-indigo-100 bg-indigo-50/40 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                          <span>Seller Hub</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-indigo-600" />
                      </Link>

                      <Link
                        href="/seller/inventory/bulk"
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 group"
                      >
                        <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                        <span>Bulk Upload</span>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Account & Inbox */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">My Account</p>
                <div className="space-y-1">
                  <Link
                    href="/dashboard?tab=coordination"
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border group ${
                      currentTab === "coordination"
                        ? "bg-primary-50/80 text-primary-700 border-primary-200/50 pl-3 border-l-4 border-l-primary-600 scale-[1.01]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className={`w-3.5 h-3.5 transition-colors ${
                        currentTab === "coordination" ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                      }`} />
                      <span>{t("chat")}</span>
                    </div>
                    {chatsCount > 0 ? (
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full transition-colors ${
                        currentTab === "coordination" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {chatsCount}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded">
                        0
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/dashboard?tab=notifications"
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider border group ${
                      currentTab === "notifications"
                        ? "bg-primary-50/80 text-primary-700 border-primary-200/50 pl-3 border-l-4 border-l-primary-600 scale-[1.01]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <Bell className={`w-3.5 h-3.5 ${
                      currentTab === "notifications" ? "text-primary-600 animate-pulse" : "text-slate-400 group-hover:text-slate-600"
                    }`} />
                    {t("notifications")}
                  </Link>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  {t("profileSettings")}
                </Link>
              </div>

              {/* Trust Fabric Sidebar Card */}
              <div className="mt-6 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("nilamitScore")}</span>
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-gray-900">
                    {(Number(session.user.rating) || 3.5).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400 font-bold ml-1">★</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-3 font-medium">{session.user.ratingCount || 0} {t("tradesCompleted")}</p>
                <Link
                  href="/leaderboard"
                  className="flex items-center justify-between w-full py-2 px-3 bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50 rounded-xl text-[10px] font-bold uppercase text-gray-600 hover:text-primary-600 transition-all"
                >
                  {t("viewLeaderboard")}
                  <ChevronRight className="w-3 h-3" />
                </Link>

                {/* Seller Performance Sync */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Account Type</span>
                    {session.user.isTopRated ? (
                      <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 animate-pulse">
                        <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                        <span className="text-[9px] font-black text-amber-700">TOP RATED</span>
                      </div>
                    ) : session.user.isRetailer ? (
                      <div className="flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        <Shield className="w-2.5 h-2.5 text-indigo-500 fill-indigo-500/10" />
                        <span className="text-[9px] font-black text-indigo-700">RETAILER</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        <Shield className="w-2.5 h-2.5 text-blue-550 fill-blue-550/10" />
                        <span className="text-[9px] font-black text-blue-700">SELLER / BIDDER</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2 rounded-xl border border-gray-50">
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Sales</p>
                      <p className="text-sm font-black text-gray-900">{session.user.salesCount || 0}</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-gray-50">
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Defect Rate</p>
                      <p className={`text-sm font-black ${
                        (session.user.defectCount / (session.user.salesCount + session.user.defectCount || 1)) > 0.03 
                          ? "text-red-600" 
                          : "text-emerald-600"
                      }`}>
                        {((session.user.defectCount || 0) / (session.user.salesCount + session.user.defectCount || 1) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {!session.user.isTopRated && (
                    <div className="p-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-[9px] text-gray-500 leading-tight">
                        <span className="font-bold">Goal:</span> 10 sales & &lt;5% defect rate for <span className="text-amber-600 font-bold">Top Rated</span> status.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 w-full">
            {currentTab === "watchlist" && (
              <div>
                <h2 className="text-xl font-heading font-semibold text-gray-900 mb-6">
                  {t("savedAuctions")} ({watchlistAuctions.length})
                </h2>
                {watchlistAuctions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {watchlistAuctions.map((auction) => (
                      <AuctionCard key={auction.id} auction={auction} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
                    <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-6 font-medium">{t("emptyWatchlist")}</p>
                    <Link
                      href="/auctions"
                      className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-wider px-6 py-3 rounded-xl shadow-md shadow-primary-600/10 hover:shadow-lg transition-all"
                    >
                      Explore Trending Deals
                    </Link>
                  </div>
                )}
              </div>
            )}

            {currentTab === "bids" && (
              <div>
                <h2 className="text-xl font-heading font-semibold text-gray-900 mb-6">
                  {t("activeWinning")} ({activeBids.length})
                </h2>
                {activeBids.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeBids.map((auction) => (
                      <AuctionCard key={auction.id} auction={auction} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-6 font-medium">
                      {t("noActiveBids")}
                    </p>
                    <Link
                      href="/auctions"
                      className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-wider px-6 py-3 rounded-xl shadow-md shadow-primary-600/10 hover:shadow-lg transition-all"
                    >
                      Find Items to Bid On
                    </Link>
                  </div>
                )}
              </div>
            )}

            {currentTab === "escrow" && (
              <div>
                <h2 className="text-xl font-heading font-semibold text-gray-900 mb-6">
                  {t("wonAndEscrow")} ({escrowTransactions.length})
                </h2>
                {escrowTransactions.length > 0 ? (
                  <div className="space-y-4">
                    {escrowTransactions.map((tx) => (
                      <EscrowActionCard 
                        key={tx.id} 
                        transaction={tx as HydratedEscrowTransaction} 
                        treasuryNumbers={{
                          bkash: systemConfig.treasuryBkash,
                          nagad: systemConfig.treasuryNagad
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {t("noWonItems")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentTab === "listings" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-heading font-semibold text-gray-900">
                    {t("myListings")} ({listingStats.totalListings})
                  </h2>
                  <Link
                    href="/auctions/create"
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl shadow-sm transition-all"
                  >
                    {tStats("newListingBtn")}
                  </Link>
                </div>

                {listingStats.totalListings > 0 && (
                  <>
                    {/* Earnings + counts header */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{tStats("netEarnings")}</p>
                        <p className="text-lg font-black text-emerald-600 truncate">{formatBDT(listingStats.netEarnings)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{tStats("afterCommission", { amount: formatBDT(listingStats.totalCommission) })}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{tStats("grossSales")}</p>
                        <p className="text-lg font-black text-gray-900 truncate">{formatBDT(listingStats.grossSales)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{tStats("soldSuffix", { count: listingStats.sold })}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{tStats("liveNow")}</p>
                        <p className="text-lg font-black text-primary-600">{listingStats.active}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{tStats("activeAuctions")}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{tStats("closedNoSale")}</p>
                        <p className="text-lg font-black text-gray-700">{listingStats.expired + listingStats.cancelled}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{tStats("closedDetail", { expired: listingStats.expired, cancelled: listingStats.cancelled })}</p>
                      </div>
                    </div>

                    {/* Status filter pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {([
                        { key: "all",       label: tStats("filterAll"),       count: listingStats.totalListings },
                        { key: "active",    label: tStats("filterActive"),    count: listingStats.active },
                        { key: "sold",      label: tStats("filterSold"),      count: listingStats.sold },
                        { key: "expired",   label: tStats("filterExpired"),   count: listingStats.expired },
                        { key: "cancelled", label: tStats("filterCancelled"), count: listingStats.cancelled },
                      ] as const).map(({ key, label, count }) => {
                        const isActive = listingFilter === key;
                        const href = key === "all" ? "/dashboard?tab=listings" : `/dashboard?tab=listings&status=${key}`;
                        return (
                          <Link
                            key={key}
                            href={href}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors ${
                              isActive
                                ? "bg-primary-600 text-white shadow-sm"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {label}
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isActive ? "bg-white/20 text-white/90" : "bg-gray-100 text-gray-500"
                            }`}>{count}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}

                {myListings.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myListings.map((auction) => (
                      <AuctionCard key={auction.id} auction={auction} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">
                      {listingStats.totalListings === 0
                        ? t("emptyListings")
                        : tStats("noFiltered", { status: listingFilter })}
                    </p>
                    {listingStats.totalListings === 0 ? (
                      <Link
                        href="/auctions/create"
                        className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-sm transition-all"
                      >
                        {tStats("createFirst")}
                      </Link>
                    ) : (
                      <Link
                        href="/dashboard?tab=listings"
                        className="inline-block text-primary-600 hover:text-primary-700 text-xs font-bold uppercase tracking-wider"
                      >
                        {tStats("showAll")}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentTab === "coordination" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-heading font-semibold text-gray-900">
                    {t("activeCoordination")} ({coordinationItems.length})
                  </h2>
                </div>
                {coordinationItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {coordinationItems.map((conv) => (
                      <Link 
                        key={conv.id} 
                        href={`/dashboard/coordination/${conv.id}`}
                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-4"
                      >
                         <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                            {conv.auction.images?.[0] ? (
                              <Image 
                                src={conv.auction.images[0]} 
                                alt={conv.auction.title} 
                                width={64} 
                                height={64} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-400">
                               <Package className="w-6 h-6" />
                             </div>
                           )}
                         </div>
                         <div className="flex-1">
                           <div className="flex items-center justify-between">
                              <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{conv.auction.title}</h3>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border bn ${
                                conv.auction.escrowTransaction?.status === 'DISPUTED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                {te(`status_${conv.auction.escrowTransaction?.status || 'PENDING'}`)}
                              </span>
                           </div>
                           <p className="text-sm text-gray-500 line-clamp-1 mt-1 font-medium italic">
                             {conv.messages?.[0]?.content || t("noMessagesYet")}
                           </p>
                            {conv.auction.logistics?.status ? (
                              <div className="flex items-center gap-2 mt-2 bg-blue-50 px-2 py-0.5 rounded-lg w-fit">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight">
                                  {conv.auction.logistics?.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wide">
                                {t("sharedLogistics")}
                              </p>
                            )}
                         </div>
                         <MessageSquare className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-colors" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {t("noCoordination")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentTab === "notifications" && (
              <div>
                <NotificationsList />
              </div>
            )}

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
