import { HomeContent } from "@/components/home/HomeContent";
import ForYouFeed from "@/components/home/components/ForYouFeed";
export const dynamic = "force-dynamic";
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";
import { unstable_cache } from "next/cache";
import { db, docData } from "@/lib/db";
import { SystemConfig } from "@/types/common";
import type { AuctionWithSeller, LatestActivity } from "@/types";
import { log } from "@/lib/logger";
import { getTopSellers } from "@/actions/user";

interface GlobalStats {
  totalUsers?: number;
  totalBids?: number;
  totalAuctions?: number;
  totalVerifiedSellers?: number;
  isReal?: boolean;
  updatedAt?: Date;
}

const FALLBACK_STATS: Required<Omit<GlobalStats, "updatedAt">> & { updatedAt: Date } = {
  totalUsers: 2450,
  totalBids: 15600,
  totalAuctions: 840,
  totalVerifiedSellers: 320,
  isReal: false,
  updatedAt: new Date(),
};

const FALLBACK_SYSTEM_CONFIG: SystemConfig = {
  id: "default",
  heroTitle: "The Future of Bidding in Bangladesh",
  heroSubtitle: "Experience transparency, security, and true market value.",
  heroImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
  updatedAt: new Date(),
} as SystemConfig;

interface ResolvedHomeData {
  trendingAuctions: AuctionWithSeller[];
  endingSoon: AuctionWithSeller[];
  latestBids: LatestActivity[];
  featuredAuctions: AuctionWithSeller[];
  stats: { totalUsers: number; totalBids: number; totalAuctions: number; verifiedSellers: number };
  systemConfig: SystemConfig;
  topSellers: Array<{
    id: string;
    name: string;
    image: string | null;
    rating: number;
    ratingCount: number;
    userLevel: number;
    salesCount: number;
    isTopRated: boolean;
  }>;
}

async function getCachedGlobalStats() {
  return unstable_cache(
    async () => {
      try {
        const globalStatsSnap = await db.collection("stats").doc("global").get();
        let statsData = docData<GlobalStats>(globalStatsSnap);

        let cacheDate: Date | null = null;
        if (statsData?.updatedAt) {
          const rawVal = statsData.updatedAt as unknown;
          if (rawVal && typeof rawVal === "object" && "toDate" in rawVal) {
            cacheDate = (rawVal as { toDate: () => Date }).toDate();
          } else {
            cacheDate = new Date(statsData.updatedAt);
          }
        }

        const isStale = cacheDate ? (Date.now() - cacheDate.getTime() > 300 * 1000) : true;

        if (!statsData || !statsData.isReal || isStale) {
          const [userCountSnap, bidCountSnap, auctionCountSnap, sellerCountSnap] = await Promise.all([
            db.collection("users").count().get(),
            db.collection("bids").count().get(),
            db.collection("auctions").count().get(),
            db.collection("users").where("isVerifiedSeller", "==", true).count().get(),
          ]);

          statsData = {
            totalUsers: userCountSnap.data().count,
            totalBids: bidCountSnap.data().count,
            totalAuctions: auctionCountSnap.data().count,
            totalVerifiedSellers: sellerCountSnap.data().count,
            isReal: true,
            updatedAt: new Date(),
          };
          await db.collection("stats").doc("global").set(statsData);
        }
        return statsData;
      } catch (err) {
        log.warn("[home] Falling back to seed stats", { error: String(err) });
        return FALLBACK_STATS;
      }
    },
    ['global-stats'],
    { revalidate: 300, tags: ['stats'] }
  )();
}

async function getCachedSystemConfig() {
  return unstable_cache(
    async () => {
      const snap = await db.collection("systemConfig").doc("default").get();
      let config = docData<SystemConfig>(snap);
      if (!config) {
        config = FALLBACK_SYSTEM_CONFIG;
        await db.collection("systemConfig").doc("default").set(config);
      }
      return config;
    },
    ['system-config'],
    { revalidate: 3600, tags: ['config'] }
  )();
}

async function loadHomeData(): Promise<ResolvedHomeData> {
  const [
    trendingRes,
    specializedRes,
    featuredRes,
    statsData,
    systemConfig,
    sellersRes,
  ] = await Promise.all([
    getAuctions({ sortBy: "bids", sortOrder: "desc", limit: 8 }),
    getSpecializedFeeds(),
    getAuctions({ isFeatured: true, sortOrder: "asc", limit: 4 }),
    getCachedGlobalStats(),
    getCachedSystemConfig(),
    getTopSellers(4),
  ]);

  return {
    trendingAuctions: trendingRes.success ? trendingRes.data!.auctions : [],
    endingSoon:       specializedRes.success ? specializedRes.data!.endingSoon : [],
    latestBids:       specializedRes.success ? specializedRes.data!.latestBids : [],
    featuredAuctions: featuredRes.success ? featuredRes.data!.auctions : [],
    stats: {
      totalUsers:      Number(statsData.totalUsers ?? 0),
      totalBids:       Number(statsData.totalBids ?? 0),
      totalAuctions:   Number(statsData.totalAuctions ?? 0),
      verifiedSellers: Number(statsData.totalVerifiedSellers ?? 0),
    },
    systemConfig,
    topSellers:       sellersRes.success ? sellersRes.data! : [],
  };
}

export default async function HomePage() {
  const locale = "en";

  // Load data inside a try so a Firestore outage falls back to a safe empty
  // state. JSX is constructed AFTER the try block — render errors propagate
  // to the nearest error boundary (the React rule we used to violate).
  let data: ResolvedHomeData;
  try {
    data = await loadHomeData();
  } catch (error) {
    log.error("[home] failed to load home data — rendering fallback", error);
    data = {
      trendingAuctions: [],
      endingSoon:       [],
      latestBids:       [],
      featuredAuctions: [],
      stats: { totalUsers: 0, totalBids: 0, totalAuctions: 0, verifiedSellers: 0 },
      systemConfig:     FALLBACK_SYSTEM_CONFIG,
      topSellers:       [],
    };
  }

  return (
    <>
      <HomeContent
        trendingAuctions={data.trendingAuctions}
        endingSoon={data.endingSoon}
        latestActivity={data.latestBids}
        featuredAuctions={data.featuredAuctions}
        stats={data.stats}
        systemConfig={data.systemConfig}
        topSellers={data.topSellers}
        locale={locale}
      />
      <ForYouFeed />
    </>
  );
}
