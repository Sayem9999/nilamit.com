import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

/**
 * Marketplace sitemap. For a C2C marketplace, every listing page is an organic
 * landing page — "iphone 13 dam bangladesh"-style queries should land on a
 * live auction, not the homepage. So this is dynamic: static surfaces plus the
 * newest ACTIVE auctions (capped — Google's per-sitemap limit is 50k, but we
 * cap far lower to keep the Firestore read bounded).
 *
 * Failure-safe: if the auctions query throws, we still return the static
 * entries — a sitemap that 500s is worse than a smaller one.
 */

export const revalidate = 3600; // regenerate at most hourly

const AUCTION_CAP = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.nilamit.com';

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/auctions`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/browse`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/how-it-works`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/safety`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/leaderboard`, changeFrequency: 'daily', priority: 0.4 },
    { url: `${baseUrl}/login`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${baseUrl}/register`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${baseUrl}/terms`, changeFrequency: 'yearly', priority: 0.1 },
  ];

  let auctionEntries: MetadataRoute.Sitemap = [];
  try {
    const snap = await db
      .collection('auctions')
      .where('status', '==', 'ACTIVE')
      .orderBy('createdAt', 'desc')
      .limit(AUCTION_CAP)
      .get();

    auctionEntries = snap.docs.map((d) => {
      const updatedAt = d.data().updatedAt;
      const lastModified =
        updatedAt?.toDate?.() instanceof Date ? updatedAt.toDate() : new Date();
      return {
        url: `${baseUrl}/auctions/${d.id}`,
        lastModified,
        changeFrequency: 'hourly' as const,
        priority: 0.8,
      };
    });
  } catch {
    // Keep the sitemap serving — static entries only.
  }

  return [...staticEntries, ...auctionEntries];
}
