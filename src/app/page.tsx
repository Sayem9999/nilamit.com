import { HomeContent } from "@/components/home/HomeContent";
export const dynamic = "force-dynamic";
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";

export default async function HomePage() {
  const [{ auctions: trendingAuctions }, { endingSoon, latestBids }] =
    await Promise.all([
      getAuctions({
        sortBy: "bids",
        sortOrder: "desc",
        limit: 8,
      }),
      getSpecializedFeeds(),
    ]);

  return (
    <HomeContent
      trendingAuctions={trendingAuctions}
      endingSoon={endingSoon}
      latestActivity={latestBids}
    />
  );
}
