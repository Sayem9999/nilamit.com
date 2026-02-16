import { HomeContent } from '@/components/home/HomeContent';
import { getAuctions } from '@/actions/auction';

export default async function HomePage() {
  const { auctions: trendingAuctions } = await getAuctions({
    sortBy: 'bids',
    sortOrder: 'desc',
    limit: 8
  });

  return <HomeContent trendingAuctions={trendingAuctions as any} />;
}
