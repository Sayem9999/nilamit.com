"use client";

import { useTranslations } from "next-intl";
import { Variants } from "framer-motion";
import { Megaphone, Star, ArrowRight } from "lucide-react";
import Link from "next/link";

import { AuctionWithSeller, SystemConfig, LatestActivity } from "@/types";
import AuctionCard from "@/components/auction/AuctionCard";

// Sub-components
import { LiveTicker } from "./components/LiveTicker";
import { HeroSection } from "./components/HeroSection";
import { TrendingSection } from "./components/TrendingSection";
import { EndingSoonSection } from "./components/EndingSoonSection";
import { CategoryGrid } from "./components/CategoryGrid";
import { TrustFeatures } from "./components/TrustFeatures";
import { StatsBar } from "./components/StatsBar";

import { AreaQuickLinks } from "./components/AreaQuickLinks";
import { TopSellersShowcase } from "./components/TopSellersShowcase";

interface HomeContentProps {
  trendingAuctions?: AuctionWithSeller[];
  endingSoon?: AuctionWithSeller[];
  featuredAuctions?: AuctionWithSeller[];
  latestActivity?: LatestActivity[];
  systemConfig?: SystemConfig;
  locale?: string;
  stats?: {
    totalUsers: number;
    totalBids: number;
    totalAuctions: number;
    verifiedSellers: number;
  };
  topSellers?: Array<{
    id: string;
    name: string;
    image: string | null;
    rating: number;
    ratingCount: number;
    userLevel: number;
    salesCount: number;
    isTopRated: boolean;
  }>;
}

export function HomeContent({
  trendingAuctions = [],
  endingSoon = [],
  featuredAuctions = [],
  latestActivity = [],
  systemConfig,
  locale = "en",
  stats,
  topSellers = [],
}: HomeContentProps) {
  const t = useTranslations("Home");

  // Cold-start awareness: when there's no live merchandising to show, the page
  // must sell the CONCEPT — so the "How it works / trust" section moves up to
  // right after the categories instead of sitting at the bottom. Once real
  // rails exist, products lead and trust drops back down (the normal
  // marketplace order).
  const isColdStart =
    trendingAuctions.length === 0 &&
    endingSoon.length === 0 &&
    featuredAuctions.length === 0;

  // A stats ribbon bragging about tiny numbers ("13 traders, 0 bids") reads as
  // a ghost town and actively hurts trust. Show it only once the numbers are
  // themselves a trust signal.
  const statsAreImpressive =
    !!stats && (stats.totalBids >= 100 || stats.totalUsers >= 100);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" as const },
    },
  };

  return (
    <>
      {/* Announcement bar (admin-controlled) */}
      {systemConfig?.showAnnouncement && systemConfig?.announcement && (
        <aside
          aria-label="Site announcement"
          className="bg-indigo-650 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2"
        >
          <Megaphone className="w-4 h-4" aria-hidden="true" />
          {systemConfig.announcement}
        </aside>
      )}

      {/* Live activity ticker — thin strip */}
      <LiveTicker initialActivity={latestActivity} />

      {/* Slim promo strip (Sell · Escrow · Ending Soon teaser) */}
      <HeroSection systemConfig={systemConfig} totalUsers={stats?.totalUsers} hasEndingSoon={endingSoon.length > 0} />

      {/* Categories — first thing below the fold, marketplace-style */}
      <CategoryGrid />

      {/* Cold start: no live rails to merchandise, so explain the model and
          the escrow safety story immediately — that's what converts a first
          visitor into a first lister. */}
      {isColdStart && <TrustFeatures systemConfig={systemConfig} />}

      {/* Ending soon — most time-sensitive merchandising */}
      <EndingSoonSection endingSoon={endingSoon} />

      {/* Trending — most active bidding */}
      <TrendingSection
        trendingAuctions={trendingAuctions}
        containerVariants={containerVariants}
        itemVariants={itemVariants}
      />

      {/* Featured rail — clean light section, not a dark "Curator's Choice" hero */}
      {featuredAuctions.length > 0 && (
        <section
          aria-labelledby="featured-heading"
          className="py-12 sm:py-16 bg-gray-50 border-y border-gray-100"
        >
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide mb-2">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {t("featuredTag")}
                </div>
                <h2
                  id="featured-heading"
                  className="font-heading font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight"
                >
                  {t("featuredTitle")}
                </h2>
              </div>
              <Link
                href="/auctions?featured=true"
                className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700 hover:gap-2 transition-all"
              >
                {t("seeAll")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {featuredAuctions.map((auction, idx) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  priority={idx < 4}
                  className="h-full"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top sellers showcase */}
      <TopSellersShowcase sellers={topSellers} />

      {/* Area / hyperlocal links */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <AreaQuickLinks locale={locale} />
      </div>

      {/* Trust footer — bottom placement once the marketplace is liquid
          (cold-start renders it up top instead, see above). */}
      {!isColdStart && <TrustFeatures systemConfig={systemConfig} />}

      {/* Stats bar — only once the numbers are big enough to BE a trust
          signal; small numbers advertise a ghost town. */}
      {statsAreImpressive && stats && (
        <StatsBar
          totalAuctions={stats.totalAuctions}
          totalUsers={stats.totalUsers}
          totalBids={stats.totalBids}
          verifiedSellers={stats.verifiedSellers}
        />
      )}
    </>
  );
}
