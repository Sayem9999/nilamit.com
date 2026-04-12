import { HomeContent } from "@/components/home/HomeContent";
import ForYouFeed from "@/components/home/components/ForYouFeed";
export const dynamic = "force-dynamic";
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";
import { prisma } from "@/lib/db";
import { AuctionStatus } from "@prisma/client";

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
    totalUsers,
    totalBids,
    totalAuctions,
    verifiedSellers,
  ] = await Promise.all([
    getAuctions({ sortBy: "bids", sortOrder: "desc", limit: 8 }),
    getSpecializedFeeds(),
    getAuctions({ limit: 4 }),
    prisma.user.count(),
    prisma.bid.count(),
    prisma.auction.count({ where: { status: AuctionStatus.ACTIVE } }),
    prisma.user.count({ where: { isVerifiedSeller: true } }),
  ]);

  return (
    <>
      <HomeContent
        trendingAuctions={trendingAuctions}
        endingSoon={endingSoon}
        latestActivity={latestBids}
        featuredAuctions={featuredAuctions}
        stats={{ totalUsers, totalBids, totalAuctions, verifiedSellers }}
      />
      <ForYouFeed />
    </>
  );
}
