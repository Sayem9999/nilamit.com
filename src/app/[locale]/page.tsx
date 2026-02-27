import { HomeContent } from "@/components/home/HomeContent";
import ForYouFeed from "@/components/home/components/ForYouFeed";
export const dynamic = "force-dynamic";
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
    <>
      <HomeContent
        trendingAuctions={trendingAuctions}
        endingSoon={endingSoon}
        latestActivity={latestBids}
      />
      <ForYouFeed />
    </>
  );
}
