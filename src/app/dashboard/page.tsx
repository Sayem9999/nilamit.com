import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import AuctionCard from "@/components/auction/AuctionCard";
import { 
  Package, Gavel, History, TrendingUp, Star, Award, ShieldCheck, 
  Settings, LayoutDashboard, Store, Wallet, AlertCircle, ArrowRight,
  MessageSquare, ExternalLink, Share2, MapPin, Search, PlusCircle, CheckCircle,
  Heart, RefreshCw, LogOut
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { AuctionWithSeller } from "@/types";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/actions/admin-content";
import { EscrowService } from "@/services/finance/escrow-service";
import { CoordinationService } from "@/services/social/coordination-service";
import { HydratedEscrowTransaction, CoordinationHubItem } from "@/types";
import {
  ChevronRight,
  Trophy,
  Shield,
  BarChart3
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations("Dashboard");
  const te = await getTranslations("Escrow");

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

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

  const { tab } = await searchParams;
  const currentTab = tab || "watchlist";

  const userId = session.user.id;

  // Fetch relevant data based on tab
  let watchlistAuctions: AuctionWithSeller[] = [];
  let myListings: AuctionWithSeller[] = [];
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

      myListings = rawSnap.docs.map(d => {
        const a = d.data();
        return {
          ...a, id: d.id,
          createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
          endTime:   a.endTime?.toDate?.()   || new Date(a.endTime),
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, rating: seller.rating, ratingCount: seller.ratingCount },
          _count: { bids: bidCountMap.get(d.id) ?? 0 },
          watchlist: [],
        };
      }) as unknown as AuctionWithSeller[];
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
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, rating: seller.rating, ratingCount: seller.ratingCount },
          _count: { bids: bidCountMap.get(w.auctionId) ?? 0 },
          watchlist: [w],
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
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-heading font-bold text-gray-900 mb-8">
          {t("title")}
        </h1>

        {/* System Announcement Sync */}
        {systemConfig.showAnnouncement && systemConfig.announcement && (
          <div className="mb-8 p-4 bg-primary-50 border border-primary-100 rounded-2xl flex items-center gap-3 text-primary-900 animate-in fade-in slide-in-from-top-4 duration-500">
            <CheckCircle className="w-5 h-5 text-primary-600" />
            <p className="font-semibold text-sm">{systemConfig.announcement}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
              <Link
                href="/dashboard?tab=watchlist"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "watchlist"
                    ? "bg-red-50 text-red-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Heart className="w-4 h-4" />
                {t("watchlist")}
              </Link>
              <Link
                href="/dashboard?tab=bids"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "bids"
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                {t("activeBids")}
              </Link>
              <Link
                href="/dashboard?tab=escrow"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "escrow"
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {t("wonEscrow")}
              </Link>
              <Link
                href="/dashboard?tab=listings"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "listings"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t("myListings")}
              </Link>
              {session.user.isVerifiedSeller && (
                 <Link
                  href="/auctions/create?bulk=true"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 border border-transparent hover:border-emerald-100`}
                >
                  <Package className="w-4 h-4" />
                  Bulk Inventory
                </Link>
              )}
              <Link
                href="/dashboard?tab=coordination"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "coordination"
                    ? "bg-purple-50 text-purple-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                {t("coordinationHub")}
              </Link>
              <div className="pt-4 mt-4 border-t border-gray-100">
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-gray-600 hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4" />
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
                {session.user.isVerifiedSeller && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Seller Status</span>
                      {session.user.isTopRated ? (
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                          <span className="text-[9px] font-black text-amber-700">TOP RATED</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          <Shield className="w-2.5 h-2.5 text-blue-500 fill-blue-500/10" />
                          <span className="text-[9px] font-black text-blue-700">VERIFIED</span>
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

                    {/* Retailer Specific Tools */}
                    <div className="pt-3">
                      <Link
                        href="/retailer/dashboard"
                        className="flex items-center justify-between w-full py-2.5 px-3 bg-[#0a0a0b] hover:bg-black rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-md group"
                      >
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                          <span>Command Center</span>
                        </div>
                        <ArrowRight className="w-3 h-3 opacity-50" />
                      </Link>

                      <Link
                        href="/seller/inventory/bulk"
                        className="flex items-center justify-between w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-md shadow-indigo-100 group"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-3 h-3 text-indigo-200 group-hover:scale-110 transition-transform" />
                          <span>Bulk Upload</span>
                        </div>
                        <ArrowRight className="w-3 h-3 opacity-50" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
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
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{t("emptyWatchlist")}</p>
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
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {t("noActiveBids")}
                    </p>
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-heading font-semibold text-gray-900">
                    {t("myListings")} ({myListings.length})
                  </h2>
                  <Link
                    href="/auctions/create"
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl shadow-sm transition-all"
                  >
                    + New Listing
                  </Link>
                </div>
                {myListings.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myListings.map((auction) => (
                      <AuctionCard key={auction.id} auction={auction} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">{t("emptyListings")}</p>
                    <Link
                      href="/auctions/create"
                      className="inline-block bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-sm transition-all"
                    >
                      Create your first listing
                    </Link>
                  </div>
                )}
              </div>
            )}

            {currentTab === "coordination" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-heading font-semibold text-gray-900">
                    {t("activeCoordination")} ({escrowTransactions.length})
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

          </div>
        </div>
      </div>
    </div>
  );
}
