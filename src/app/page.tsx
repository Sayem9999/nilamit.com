import { HomeContent } from "@/components/home/HomeContent";
import ForYouFeed from "@/components/home/components/ForYouFeed";
export const revalidate = 60; // Cache the homepage for 60 seconds to prevent DB exhaustion
import { getAuctions, getSpecializedFeeds } from "@/actions/auction";
import { db } from "@/lib/db";
import { SystemConfig } from "@/types/common";


export default async function HomePage() {
  const locale = "en";

  try {
    const [
      trendingRes,
      specializedRes,
      featuredRes,
      globalStatsSnap,
      systemConfigSnap,
    ] = await Promise.all([
      getAuctions({ sortBy: "bids", sortOrder: "desc", limit: 8 }),
      getSpecializedFeeds(),
      getAuctions({ limit: 4 }),
      db.collection('stats').doc('global').get(),
      db.collection('systemConfig').doc('default').get(),
    ]);

    // First-run safeguard: Seed initial data if missing
    let statsData = globalStatsSnap.exists ? globalStatsSnap.data() : null;
    if (!statsData) {
      statsData = {
        totalUsers: 2450,
        totalBids: 15600,
        totalAuctions: 840,
        totalVerifiedSellers: 320,
        updatedAt: new Date()
      };
      await db.collection('stats').doc('global').set(statsData);
    }

    let systemConfig = systemConfigSnap.exists ? (systemConfigSnap.data() as SystemConfig) : null;
    if (!systemConfig) {
      systemConfig = {
        heroTitle: "The Future of Bidding in Bangladesh",
        heroSubtitle: "Experience transparency, security, and true market value.",
        heroImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
        updatedAt: new Date()
      } as SystemConfig;
      await db.collection('systemConfig').doc('default').set(systemConfig);
    }

    const trendingAuctions = trendingRes.success ? trendingRes.data!.auctions : [];
    const endingSoon = specializedRes.success ? specializedRes.data!.endingSoon : [];
    const latestBids = specializedRes.success ? specializedRes.data!.latestBids : [];
    const featuredAuctions = featuredRes.success ? featuredRes.data!.auctions : [];

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
          systemConfig={systemConfig}
          locale={locale}
        />
        <ForYouFeed />
      </>
    );
  } catch (error: unknown) {
    const err = error as Error;
    return (
      <div style={{ padding: '2rem', backgroundColor: '#fee2e2', color: '#7f1d1d', margin: '1rem', borderRadius: '0.5rem', fontFamily: 'monospace' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Application Error Details</h1>
        <p><strong>Message:</strong> {err?.message || String(error)}</p>
        <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>{err?.stack}</pre>
      </div>
    );
  }
}
