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
  let activeBids: AuctionWithSeller[] = [];

  // Coordination/Escrow items can have slightly different shapes
  type CoordinationItem = {
    id: string;
    auctionId: string;
    lastMessageAt: Date | number;
    auction: { title: string; images: string[]; id: string; escrowTransaction?: { status: string; id: string } };
    messages: { id: string; content: string; createdAt: Date; senderId: string }[];
  };

  type EscrowListItem = {
    id: string;
    auctionId: string;
    amount: number;
    status: string;
    createdAt: Date;
    auction: { id: string; title: string; images: string[]; seller: { name: string | null; image: string | null }; endTime: Date | string };
    dispute: { id: string; reason: string } | null;
  };

  let escrowTransactions: (EscrowListItem | CoordinationItem)[] = [];

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

      watchlistAuctions = rawSnap.docs.map(d => {
        const a = d.data();
        return {
          ...a, id: d.id,
          createdAt: a.createdAt?.toDate?.() || new Date(a.createdAt),
          endTime:   a.endTime?.toDate?.()   || new Date(a.endTime),
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, reputationScore: seller.reputationScore },
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
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, reputationScore: seller.reputationScore },
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
          seller: { name: seller.name, image: seller.image, isVerifiedSeller: seller.isVerifiedSeller, reputationScore: seller.reputationScore },
          _count: { bids: bidCountMap.get(id) ?? 0 },
          watchlist: [],
        };
      }).filter(Boolean) as unknown as AuctionWithSeller[];
    }

  // ─── ESCROW ────────────────────────────────────────────────────────────────
  } else if (currentTab === "escrow") {
    const escrowSnap = await db.collection('escrowTransactions')
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    if (!escrowSnap.empty) {
      const escrowDocs = escrowSnap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; auctionId: string; createdAt: FirebaseFirestore.Timestamp; [key: string]: unknown }));
      const auctionIds = [...new Set(escrowDocs.map(e => e.auctionId))];

      // Batch auctions + disputes in parallel
      const [auctionSnaps, disputeSnaps] = await Promise.all([
        db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id))),
        Promise.all(escrowDocs.map(e =>
          db.collection('disputes').where('transactionId', '==', e.id).limit(1).get()
        )),
      ]);
      const auctionMap = new Map(auctionSnaps.map(s => [s.id, s.exists ? s.data()! : null]));

      // Batch sellers
      const sellerIds = [...new Set(auctionSnaps.map(s => s.data()?.sellerId).filter(Boolean) as string[])];
      const sellerMap = new Map<string, FirebaseFirestore.DocumentData>();
      if (sellerIds.length > 0) {
        const sellerSnaps = await db.getAll(...sellerIds.map(id => db.collection('users').doc(id)));
        sellerSnaps.forEach(s => sellerMap.set(s.id, s.data() ?? {}));
      }

      escrowTransactions = escrowDocs.map((e, i) => {
        const a = auctionMap.get(e.auctionId);
        if (!a) return null;
        const seller = sellerMap.get(a.sellerId as string) ?? {};
        return {
          ...e,
          createdAt: e.createdAt?.toDate?.() || new Date(),
          auction: { 
            ...a, 
            id: e.auctionId, 
            images: a.images || [],
            seller: { name: seller.name, image: seller.image },
            endTime: a.endTime?.toDate?.() || new Date(a.endTime)
          },
          dispute: disputeSnaps[i].empty ? null : { ...disputeSnaps[i].docs[0].data(), id: disputeSnaps[i].docs[0].id },
        } as EscrowListItem;
      }).filter((x): x is EscrowListItem => x !== null);
    }

  // ─── COORDINATION HUB ──────────────────────────────────────────────────────
  } else if (currentTab === "coordination") {
    const [buyerConvSnap, sellerConvSnap] = await Promise.all([
      db.collection('conversations').where('buyerId', '==', userId).get(),
      db.collection('conversations').where('sellerId', '==', userId).get(),
    ]);

    const convMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    [...buyerConvSnap.docs, ...sellerConvSnap.docs].forEach(d => convMap.set(d.id, d));
    const allConvs = Array.from(convMap.values()).map(d => ({ ...d.data(), id: d.id } as { id: string; auctionId: string; lastMessageAt: number; [key: string]: unknown }));

    if (allConvs.length > 0) {
      const auctionIds = [...new Set(allConvs.map(c => c.auctionId))];

      // Batch auctions, escrows, and last messages in two passes
      const [auctionSnaps, escrowSnaps, messageSnaps] = await Promise.all([
        db.getAll(...auctionIds.map(id => db.collection('auctions').doc(id))),
        db.getAll(...auctionIds.map(id => db.collection('escrowTransactions').doc(id))),
        Promise.all(allConvs.map(conv =>
          db.collection('messages')
            .where('conversationId', '==', conv.id)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get()
        )),
      ]);
      const auctionMap = new Map(auctionSnaps.map(s => [s.id, s.exists ? s.data()! : null]));
      const escrowMap  = new Map(escrowSnaps.map(s => [s.id, s.exists ? s.data()! : null]));

      escrowTransactions = allConvs.map((conv, i) => {
        const a      = auctionMap.get(conv.auctionId);
        const escrow = escrowMap.get(conv.auctionId);
        if (!a || !escrow) return null;
        if (escrow.status !== 'HELD' && escrow.status !== 'DISPUTED') return null;

        return {
          ...conv,
          lastMessageAt: conv.lastMessageAt,
          auction: {
            title: a.title, 
            images: a.images || [], 
            id: conv.auctionId,
            escrowTransaction: { status: escrow.status, id: conv.auctionId },
          },
          messages: messageSnaps[i].empty
            ? []
            : [{ ...messageSnaps[i].docs[0].data() as { content: string; createdAt: Date; senderId: string }, id: messageSnaps[i].docs[0].id }],
        } as CoordinationItem;
      }).filter((x): x is CoordinationItem => x !== null).sort((a, b) =>
        (Number(b.lastMessageAt) || 0) - (Number(a.lastMessageAt) || 0)
      );
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
              <div className="mt-6 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t("nilamitScore")}</span>
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-gray-900">
                    {Number(session.user.reputationScore) || 0}
                  </span>
                  <span className="text-xs text-gray-400 font-bold ml-1">{t("reputationPoints")}</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-3 font-medium">{t("trustPointsTitle")}</p>
                <Link
                  href={`/${locale}/leaderboard`}
                  className="flex items-center justify-between w-full py-2 px-3 bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50 rounded-xl text-[10px] font-bold uppercase text-gray-600 hover:text-primary-600 transition-all"
                >
                  {t("viewLeaderboard")}
                  <ChevronRight className="w-3 h-3" />
                </Link>
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
                        transaction={tx as EscrowListItem} 
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
                            {(conv as CoordinationItem).auction.images?.[0] ? (
                              <Image 
                                src={(conv as CoordinationItem).auction.images[0]} 
                                alt={(conv as CoordinationItem).auction.title} 
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
                              <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{(conv as CoordinationItem).auction.title}</h3>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border bn ${
                                (conv as CoordinationItem).auction.escrowTransaction?.status === 'DISPUTED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                {te(`status_${(conv as CoordinationItem).auction.escrowTransaction?.status || 'PENDING'}`)}
                              </span>
                           </div>
                           <p className="text-sm text-gray-500 line-clamp-1 mt-1 font-medium italic">
                             {(conv as CoordinationItem).messages?.[0]?.content || t("noMessagesYet")}
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
