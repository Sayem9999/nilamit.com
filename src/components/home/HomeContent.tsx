"use client";

import { useTranslations } from "next-intl";

import { Variants } from "framer-motion";
import { Megaphone, Star } from "lucide-react";
import { AuctionWithSeller } from "@/types";
import { SystemConfig } from "@/types";
import AuctionCard from "@/components/auction/AuctionCard";

// Sub-components
import { LiveTicker, LatestActivity } from "./components/LiveTicker";
import { HeroSection } from "./components/HeroSection";
import { TrendingSection } from "./components/TrendingSection";
import { EndingSoonSection } from "./components/EndingSoonSection";
import { CategoryGrid } from "./components/CategoryGrid";
import { TrustFeatures } from "./components/TrustFeatures";
import { StatsBar } from "./components/StatsBar";

import { AreaQuickLinks } from "./components/AreaQuickLinks";

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
}

export function HomeContent({
  trendingAuctions = [],
  endingSoon = [],
  featuredAuctions = [],
  latestActivity = [],
  systemConfig,
  locale = "en",
  stats,
}: HomeContentProps) {
  const t = useTranslations("Home");

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  };

  return (
    <>
      {/* Announcement Bar */}
      {systemConfig?.showAnnouncement && systemConfig?.announcement && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <Megaphone className="w-4 h-4 animate-bounce" />
          {systemConfig.announcement}
        </div>
      )}

      {/* Live Ticker */}
      <LiveTicker initialActivity={latestActivity} />

      {/* Hero Section */}
      <HeroSection systemConfig={systemConfig} totalUsers={stats?.totalUsers} />

      {/* Live Stats Bar */}
      {stats && (
        <StatsBar
          totalAuctions={stats.totalAuctions}
          totalUsers={stats.totalUsers}
          totalBids={stats.totalBids}
          verifiedSellers={stats.verifiedSellers}
        />
      )}

      {/* Featured Auctions */}
      {featuredAuctions.length > 0 && (
        <section className="py-16 bg-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <h2 className="font-heading font-black text-3xl text-gray-900">
                  {t("featuredTitle")}
                </h2>
                <p className="text-gray-500 text-sm font-medium">
                  {t("featuredSubtitle")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredAuctions.map((auction, idx) => (
                <AuctionCard key={auction.id} auction={auction} priority={idx < 4} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Section */}
      <TrendingSection
        trendingAuctions={trendingAuctions}
        containerVariants={containerVariants}
        itemVariants={itemVariants}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Ending Soon Section */}
        <EndingSoonSection endingSoon={endingSoon} />

        {/* Categories */}
        <CategoryGrid />
        
        {/* Area Hyper-localization */}
        <AreaQuickLinks locale={locale} />
      </div>

      {/* Trust & How It Works */}
      <TrustFeatures />
    </>
  );
}
