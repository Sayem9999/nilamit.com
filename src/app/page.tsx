import { HomeContent } from '@/components/home/HomeContent';
import { getAuctions, getSpecializedFeeds } from '@/actions/auction';

export default async function HomePage() {
  const [{ auctions: trendingAuctions }, { endingSoon, latestBids }] = await Promise.all([
    getAuctions({
      sortBy: 'bids',
      sortOrder: 'desc',
      limit: 8
    }),
    getSpecializedFeeds()
  ]);

  return (
    <HomeContent 
      trendingAuctions={trendingAuctions as any} 
      endingSoon={endingSoon as any}
      latestActivity={latestBids as any}
    />
  );
}
