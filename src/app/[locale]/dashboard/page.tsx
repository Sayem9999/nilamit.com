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
import { SellerPerformance } from "@/components/seller/SellerPerformance";
import {
  BarChart3,
  ChevronRight,
  Trophy
} from "lucide-react";

type DocData = FirebaseFirestore.DocumentData;

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(v as string);
}

function normalizeAuctionDoc(id: string, a: DocData) {
  return {
    ...a,
    id,
    startTime: toDate(a.startTime),
    endTime:   toDate(a.endTime),
    createdAt: toDate(a.createdAt),
    updatedAt: toDate(a.updatedAt),
  } as { id: string; startTime: Date; endTime: Date; createdAt: Date; updatedAt: Date; [key: string]: any };
}

async function enrichAuctions(rawAuctions: { id: string; data: DocData }[], userId: string): Promise<AuctionWithSeller[]> {
  if (rawAuctions.length === 0) return [];
  const sellerIds   = [...new Set(rawAuctions.map(r => r.data.sellerId as string))];
  const sellerSnaps = await Promise.all(sellerIds.map(sid => db.collection("users").doc(sid).get()));
  const sellersMap  = new Map(sellerSnaps.map(s => {
    const u = s.data() ?? {};
    return [s.id, {
      id:               s.id,
      name:             u.name ?? null,
      image:            u.image ?? null,
      isVerifiedSeller: u.isVerifiedSeller ?? false,
      reputationScore:  u.reputationScore  ?? 0,
    }];
  }));

  const watchSnaps = await Promise.all(rawAuctions.map(r =>
    db.collection("watchlist").doc(`${userId}_${r.id}`).get()
  ));
  const watchedSet = new Set(watchSnaps.filter(s => s.exists).map(s => s.id));

  return rawAuctions.map(r => {
    const a       = normalizeAuctionDoc(r.id, r.data);
    const watched = watchedSet.has(`${userId}_${r.id}`);
    return {
      ...a,
      seller:    sellersMap.get(a.sellerId) ?? { id: a.sellerId, name: null, image: null, isVerifiedSeller: false, reputationScore: 0 },
      watchlist: watched ? [{ userId }] : [],
      _count:    { bids: a.bidCount ?? 0 },
    } as unknown as AuctionWithSeller;
  });
}

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

  let watchlistAuctions: AuctionWithSeller[] = [];
  let activeBids: AuctionWithSeller[] = [];
   
  let escrowTransactions: any[] = [];

  if (currentTab === "listings") {
    const snap = await db.collection("auctions")
      .where("sellerId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    watchlistAuctions = await enrichAuctions(snap.docs.map(d => ({ id: d.id, data: d.data() })), userId);
  } else if (currentTab === "watchlist") {
    const snap = await db.collection("watchlist")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    const auctionIds = snap.docs.map(d => d.data().auctionId as string).filter(Boolean);
    const aucSnaps   = await Promise.all(auctionIds.map(id => db.collection("auctions").doc(id).get()));
    const raws       = aucSnaps.filter(s => s.exists).map(s => ({ id: s.id, data: s.data()! }));
    watchlistAuctions = await enrichAuctions(raws, userId);
  } else if (currentTab === "bids") {
    const bidSnap = await db.collection("bids")
      .where("bidderId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    const auctionIds = [...new Set(bidSnap.docs.map(d => d.data().auctionId as string))];
    const aucSnaps = await Promise.all(auctionIds.map(id => db.collection("auctions").doc(id).get()));
    const raws = aucSnaps
      .filter(s => s.exists && s.data()?.status === "ACTIVE")
      .map(s => ({ id: s.id, data: s.data()! }));
    activeBids = await enrichAuctions(raws, userId);
  } else if (currentTab === "escrow") {
    const txSnap = await db.collection("escrowTransactions")
      .where("buyerId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() } as DocData & { id: string; auctionId: string }));
    const auctionIds = txs.map(t => t.auctionId).filter(Boolean);

    const [aucSnaps, dispSnaps] = await Promise.all([
      Promise.all(auctionIds.map(id => db.collection("auctions").doc(id).get())),
      Promise.all(txs.map(t => db.collection("disputes").where("transactionId", "==", t.id).limit(1).get())),
    ]);

    const aucMap = new Map(aucSnaps.filter(s => s.exists).map(s => [s.id, s.data()!] as const));
    const sellerIds = [...new Set([...aucMap.values()].map(a => a.sellerId as string))];
    const sellerSnaps = await Promise.all(sellerIds.map(sid => db.collection("users").doc(sid).get()));
    const sellerMap = new Map(sellerSnaps.map(s => {
      const u = s.data() ?? {};
      return [s.id, { name: u.name ?? null, image: u.image ?? null }];
    }));

    escrowTransactions = txs.map((tx, i) => {
      const auc       = aucMap.get(tx.auctionId);
      const dispDocs  = dispSnaps[i].docs;
      const dispute   = dispDocs[0] ? { id: dispDocs[0].id, ...dispDocs[0].data() } : null;
      const seller    = auc ? sellerMap.get(auc.sellerId as string) ?? { name: null, image: null } : { name: null, image: null };
      return {
        ...tx,
        createdAt: toDate(tx.createdAt),
        updatedAt: toDate(tx.updatedAt),
        auction: auc ? { ...normalizeAuctionDoc(tx.auctionId, auc), seller } : null,
        dispute,
      };
    });
  } else if (currentTab === "coordination") {
    const [buyerSnap, sellerSnap] = await Promise.all([
      db.collection("conversations").where("buyerId",  "==", userId).orderBy("lastMessageAt", "desc").get(),
      db.collection("conversations").where("sellerId", "==", userId).orderBy("lastMessageAt", "desc").get(),
    ]);

    const convsMap = new Map<string, DocData & { id: string; auctionId: string; lastMessageAt: Date }>();
    for (const d of [...buyerSnap.docs, ...sellerSnap.docs]) {
      if (convsMap.has(d.id)) continue;
      const data = d.data();
      convsMap.set(d.id, { ...data, id: d.id, auctionId: data.auctionId, lastMessageAt: toDate(data.lastMessageAt) });
    }
    const convs = [...convsMap.values()].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    if (convs.length > 0) {
      const auctionIds = [...new Set(convs.map(c => c.auctionId).filter(Boolean))];
      const [aucSnaps, escrowSnaps, lastMsgsSnaps] = await Promise.all([
        Promise.all(auctionIds.map(id => db.collection("auctions").doc(id).get())),
        Promise.all(auctionIds.map(id => db.collection("escrowTransactions").doc(id).get())),
        Promise.all(convs.map(c =>
          db.collection("messages")
            .where("conversationId", "==", c.id)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get()
        )),
      ]);

      const aucMap    = new Map(aucSnaps.filter(s => s.exists).map(s => [s.id, s.data()!] as const));
      const escrowMap = new Map(escrowSnaps.filter(s => s.exists).map(s => [s.id, s.data()!] as const));

      const disputeSnaps = await Promise.all(
        [...escrowMap.entries()].map(([txId]) =>
          db.collection("disputes").where("transactionId", "==", txId).limit(1).get()
        )
      );
      const disputeMap = new Map(
        [...escrowMap.keys()].map((txId, i) => {
          const d = disputeSnaps[i].docs[0];
          return [txId, d ? { id: d.id, ...d.data() } : null] as const;
        })
      );

      const filtered = convs
        .map((c, i) => {
          const escrow  = escrowMap.get(c.auctionId);
          const auc     = aucMap.get(c.auctionId);
          const lastMsg = lastMsgsSnaps[i].docs[0];
          if (!escrow || !["HELD", "DISPUTED"].includes(escrow.status as string)) return null;
          return {
            ...c,
            auction: auc ? {
              id:     c.auctionId,
              title:  auc.title,
              images: auc.images ?? [],
              escrowTransaction: {
                id:      c.auctionId,
                status:  escrow.status,
                dispute: disputeMap.get(c.auctionId) ?? null,
              },
            } : null,
            messages: lastMsg ? [{ id: lastMsg.id, ...lastMsg.data() }] : [],
          };
        })
        .filter(Boolean);

      escrowTransactions = filtered;
    }
  } else if (currentTab === "performance") {
    const snap = await db.collection("auctions")
      .where("sellerId", "==", userId)
      .get();
    const sellerAuctions = snap.docs.map(d => ({
      status:       d.data().status as string,
      currentPrice: Number(d.data().currentPrice ?? 0),
    }));
    const soldCount = sellerAuctions.filter(a => a.status === "SOLD").length;
    const stats = {
      totalSales: soldCount,
      revenue:    sellerAuctions.reduce((acc, c) => acc + c.currentPrice, 0),
      reputation: typeof session.user.reputationScore === "number" ? session.user.reputationScore : 0,
      successRate: sellerAuctions.length > 0 ? Math.round((soldCount / sellerAuctions.length) * 100) : 100,
    };
    escrowTransactions = [stats];
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
              <Link
                href={`/${locale}/dashboard?tab=performance`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                  currentTab === "performance"
                    ? "bg-amber-50 text-amber-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                {t("sellerPerformance")}
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
                            {conv.auction?.images?.[0] ? (
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
                              <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{conv.auction?.title}</h3>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border bn ${
                                conv.auction?.escrowTransaction?.status === 'DISPUTED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                {te(`status_${conv.auction?.escrowTransaction?.status || 'PENDING'}`)}
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

            {currentTab === "performance" && (
              <SellerPerformance stats={escrowTransactions[0]} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
