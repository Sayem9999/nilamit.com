import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import AuctionCard from "@/components/auction/AuctionCard";
import { Package, Heart, RefreshCw, LogOut, CheckCircle, MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { AuctionWithSeller } from "@/types";
import { EscrowActionCard } from "@/components/social/EscrowActionCard";
import { getTranslations } from "next-intl/server";
import { getSystemConfig } from "@/actions/admin-content";
import {
  ChevronRight,
  Trophy
} from "lucide-react";
import type { User } from "@/types";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  const t = await getTranslations("Dashboard");
  const te = await getTranslations("Escrow");

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/dashboard`);
  }

  const configFromDb = await getSystemConfig();
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
  let activeBids: AuctionWithSeller[] = [];
  // Intentional any[]: this slot holds one of three shapes depending on
  // currentTab (escrow list, conversations list, or a single SellerStats).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let escrowTransactions: any[] = [];

  if (currentTab === "listings") {
    const rawSnap = await db.collection('auctions')
      .where('sellerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    watchlistAuctions = await Promise.all(rawSnap.docs.map(async d => {
      const a = d.data();
      const bidsSnap = await db.collection('bids').where('auctionId', '==', d.id).get();
      const wSnap = await db.collection('watchlist').where('auctionId', '==', d.id).where('userId', '==', userId).get();
      const sellerSnap = await db.collection('users').doc(userId).get();
      const seller = sellerSnap.data()!;
      return {
        ...a, id: d.id,
        createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
        endTime: a.endTime?.toDate?.() || new Date(a.endTime),
        seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, reputationScore: seller.reputationScore },
        _count: { bids: bidsSnap.size },
        watchlist: wSnap.docs.map(w => w.data()),
      };
    })) as unknown as AuctionWithSeller[];
  } else if (currentTab === "watchlist") {
    const watchSnap = await db.collection('watchlist').where('userId', '==', userId).get();
    
    const results = await Promise.all(watchSnap.docs.map(async d => {
      const w = d.data();
      const aSnap = await db.collection('auctions').doc(w.auctionId).get();
      if (!aSnap.exists) return null;
      const a = aSnap.data()!;
      const bidsSnap = await db.collection('bids').where('auctionId', '==', w.auctionId).get();
      const sellerSnap = await db.collection('users').doc(a.sellerId).get();
      const seller = sellerSnap.exists ? sellerSnap.data()! : {};
      return {
        ...a, id: w.auctionId,
        createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
        endTime: a.endTime?.toDate?.() || new Date(a.endTime),
        seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, reputationScore: seller.reputationScore },
        _count: { bids: bidsSnap.size },
        watchlist: [w],
      };
    }));
    watchlistAuctions = results.filter(Boolean) as unknown as AuctionWithSeller[];
  } else if (currentTab === "bids") {
    const bidsSnap = await db.collection('bids').where('bidderId', '==', userId).orderBy('createdAt', 'desc').get();
    const uniqueAuctionIds = [...new Set(bidsSnap.docs.map(d => d.data().auctionId))];
    
    const results = await Promise.all(uniqueAuctionIds.map(async auctionId => {
      const aSnap = await db.collection('auctions').doc(auctionId as string).get();
      if (!aSnap.exists) return null;
      const a = aSnap.data()!;
      if (a.status !== 'ACTIVE') return null;
      
      const bSnap = await db.collection('bids').where('auctionId', '==', auctionId).get();
      const wSnap = await db.collection('watchlist').where('auctionId', '==', auctionId).where('userId', '==', userId).get();
      const sellerSnap = await db.collection('users').doc(a.sellerId).get();
      const seller = sellerSnap.exists ? sellerSnap.data()! : {};
      
      return {
        ...a, id: auctionId,
        createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
        endTime: a.endTime?.toDate?.() || new Date(a.endTime),
        seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, reputationScore: seller.reputationScore },
        _count: { bids: bSnap.size },
        watchlist: wSnap.docs.map(w => w.data()),
      };
    }));
    activeBids = results.filter(Boolean) as unknown as AuctionWithSeller[];
  } else if (currentTab === "escrow") {
    const escrowSnap = await db.collection('escrowTransactions').where('buyerId', '==', userId).orderBy('createdAt', 'desc').get();
    
    escrowTransactions = await Promise.all(escrowSnap.docs.map(async d => {
      const e = d.data();
      const aSnap = await db.collection('auctions').doc(e.auctionId).get();
      const a = aSnap.exists ? aSnap.data()! : null;
      let seller: Partial<User> = {};
      if (a) {
        const sSnap = await db.collection('users').doc(a.sellerId).get();
        seller = sSnap.exists ? sSnap.data()! : {};
      }
      const disputeSnap = await db.collection('disputes').where('transactionId', '==', d.id).limit(1).get();
      
      return {
        ...e, id: d.id,
        createdAt: e.createdAt?.toDate?.() || new Date(e.createdAt),
        auction: a ? { ...a, id: e.auctionId, seller: { name: seller.name, image: seller.image } } : null,
        dispute: disputeSnap.empty ? null : { ...disputeSnap.docs[0].data(), id: disputeSnap.docs[0].id },
      };
    }));
  } else if (currentTab === "coordination") {
    // Phase 11: Coordination Hub (Post-Advance Chat)
    // Firestore OR queries for buyerId == userId OR sellerId == userId
    // Since Firestore doesn't easily do OR across fields, we do two queries and merge
    const buyerConvSnap = await db.collection('conversations').where('buyerId', '==', userId).get();
    const sellerConvSnap = await db.collection('conversations').where('sellerId', '==', userId).get();
    
    const convMap = new Map();
    [...buyerConvSnap.docs, ...sellerConvSnap.docs].forEach(d => convMap.set(d.id, d));
    
    const allConvs = Array.from(convMap.values()).map(d => ({ ...d.data(), id: d.id }));
    
    const results = await Promise.all(allConvs.map(async conv => {
      const aSnap = await db.collection('auctions').doc(conv.auctionId).get();
      if (!aSnap.exists) return null;
      const a = aSnap.data()!;
      
      const eSnap = await db.collection('escrowTransactions').doc(conv.auctionId).get();
      const escrow = eSnap.exists ? eSnap.data()! : null;
      
      if (!escrow || (escrow.status !== 'HELD' && escrow.status !== 'DISPUTED')) return null;
      
      const mSnap = await db.collection('messages').where('conversationId', '==', conv.id).orderBy('createdAt', 'desc').limit(1).get();
      
      return {
        ...conv,
        auction: {
          title: a.title, images: a.images, id: conv.auctionId,
          escrowTransaction: { status: escrow.status, id: eSnap.id }
        },
        messages: mSnap.empty ? [] : [{ ...mSnap.docs[0].data(), id: mSnap.docs[0].id }]
      };
    }));
    
    escrowTransactions = results.filter(Boolean).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
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
                href={`/${locale}/dashboard?tab=watchlist`}
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
                href={`/${locale}/dashboard?tab=bids`}
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
                href={`/${locale}/dashboard?tab=escrow`}
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
                href={`/${locale}/dashboard?tab=listings`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "listings"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Package className="w-4 h-4" />
                {t("myListings")}
              </Link>
              <Link
                href={`/${locale}/dashboard?tab=coordination`}
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
                  href={`/${locale}/profile`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm text-gray-600 hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4" />
                  {t("profileSettings")}
                </Link>
              </div>

              {/* Trust Fabric Sidebar Card */}
              <div className="mt-6 p-6 rounded-[2rem] bg-indigo-900 text-white shadow-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] group-hover:bg-indigo-500/40 transition-all" />
                 <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                       <Trophy className="w-6 h-6 text-amber-400" />
                       <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{t("nilamitScore")}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">
                        {Number(session.user.reputationScore) || 0}
                      </span>
                      <span className="text-xs text-indigo-300 ml-1">{t("reputationPoints")}</span>
                    </div>
                    <p className="text-[10px] text-indigo-300 mb-4 font-bold uppercase">{t("trustPointsTitle")}</p>
                    <Link 
                      href={`/${locale}/leaderboard`}
                      className="flex items-center justify-between w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold uppercase transition-all"
                    >
                      {t("viewLeaderboard")}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                 </div>
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
                        transaction={tx} 
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

            {currentTab === "coordination" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-heading font-semibold text-gray-900">
                    {t("activeCoordination")} ({escrowTransactions.length})
                  </h2>
                </div>
                {escrowTransactions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {escrowTransactions.map((conv) => (
                      <Link 
                        key={conv.id} 
                        href={`/${locale}/dashboard/coordination/${conv.id}`}
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
                            <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wide">
                              {t("sharedLogistics")}
                            </p>
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
