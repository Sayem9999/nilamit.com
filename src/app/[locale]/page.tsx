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
    { auctions: trendingAuctions },
    { endingSoon, latestBids },
    { auctions: featuredAuctions },
    totalUsersSnap,
    totalBidsSnap,
    totalAuctionsSnap,
    verifiedSellersSnap,
  ] = await Promise.all([
    getAuctions({ sortBy: "bids", sortOrder: "desc", limit: 8 }),
    getSpecializedFeeds(),
    getAuctions({ limit: 4 }),
    db.collection('users').count().get(),
    db.collection('bids').count().get(),
    db.collection('auctions').where('status', '==', 'ACTIVE').count().get(),
    db.collection('users').where('isVerifiedSeller', '==', true).count().get(),
  ]);

  const totalUsers = totalUsersSnap.data().count;
  const totalBids = totalBidsSnap.data().count;
  const totalAuctions = totalAuctionsSnap.data().count;
  const verifiedSellers = verifiedSellersSnap.data().count;

  return (
    <>
      <HomeContent
        trendingAuctions={trendingAuctions as any}
        endingSoon={endingSoon as any}
        latestActivity={latestBids as any}
        featuredAuctions={featuredAuctions as any}
        stats={{ totalUsers, totalBids, totalAuctions, verifiedSellers }}
        locale={locale}
      />
      <ForYouFeed />
    </>
  );
}
