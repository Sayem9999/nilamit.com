import { HomeContent } from "@/components/home/HomeContent";
import ForYouFeed from "@/components/home/components/ForYouFeed";
export const dynamic = "force-dynamic";
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";
import { db } from "@/lib/db";
import { AuctionStatus } from "@/types";

async function countCollection(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.count().get();
  return snap.data().count;
}

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
    countCollection(db.collection("users")),
    countCollection(db.collection("bids")),
    countCollection(db.collection("auctions").where("status", "==", AuctionStatus.ACTIVE)),
    countCollection(db.collection("users").where("isVerifiedSeller", "==", true)),
  ]);

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
