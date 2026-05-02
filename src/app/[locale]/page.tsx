import { HomeContent } from "@/components/home/HomeContent";
import ForYouFeed from "@/components/home/components/ForYouFeed";
export const dynamic = "force-dynamic";
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";
import { db } from "@/lib/db";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const [
    trendingRes,
    specializedRes,
    featuredRes,
    totalUsersSnap,
    totalBidsSnap,
    totalAuctionsSnap,
    verifiedSellersSnap,
  ] = await Promise.all([
    getAuctions({ sortBy: "bids", sortOrder: "desc", limit: 8 }),
    getSpecializedFeeds(),
    getAuctions({ limit: 4 }),
    db.collection('stats').doc('global').get(),
  ]);

  const trendingAuctions = trendingRes.success ? trendingRes.data!.auctions : [];
  const endingSoon = specializedRes.success ? specializedRes.data!.endingSoon : [];
  const latestBids = specializedRes.success ? specializedRes.data!.latestBids : [];
  const featuredAuctions = featuredRes.success ? featuredRes.data!.auctions : [];

  const statsData = specializedRes.success ? (totalUsersSnap.data() || {}) : {};
  const totalUsers = Number(statsData.totalUsers ?? 0);
  const totalBids = Number(statsData.totalBids ?? 0);
  const totalAuctions = Number(statsData.totalAuctions ?? 0);
  const verifiedSellers = Number(statsData.totalVerifiedSellers ?? 0);

  return (
    <>
      <HomeContent
        trendingAuctions={trendingAuctions}
        endingSoon={endingSoon}
        latestActivity={latestBids}
        featuredAuctions={featuredAuctions}
        stats={{ totalUsers, totalBids, totalAuctions, verifiedSellers }}
        locale={locale}
      />
      <ForYouFeed />
    </>
  );
}
