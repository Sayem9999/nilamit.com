"use client";

import { Variants } from "framer-motion";
import { Megaphone, Star } from "lucide-react";
import { AuctionWithSeller } from "@/types";
import { SystemConfig } from "@/types/home"; // Added SystemConfig import
import { useLanguage } from "@/context/LanguageContext";
import AuctionCard from "@/components/auction/AuctionCard";

// Sub-components
import { LiveTicker, LatestActivity } from "./components/LiveTicker";
import { HeroSection } from "./components/HeroSection";
import { TrendingSection } from "./components/TrendingSection";
import { EndingSoonSection } from "./components/EndingSoonSection";
import { CategoryGrid } from "./components/CategoryGrid";
import { TrustFeatures } from "./components/TrustFeatures";

interface HomeContentProps {
  trendingAuctions?: AuctionWithSeller[];
  endingSoon?: AuctionWithSeller[];
  featuredAuctions?: AuctionWithSeller[];
  latestActivity?: LatestActivity[];
  systemConfig?: SystemConfig; // Changed type from any to SystemConfig
}

export function HomeContent({
  trendingAuctions = [],
  endingSoon = [],
  featuredAuctions = [],
  latestActivity = [],
  systemConfig,
}: HomeContentProps) {
  const { t } = useLanguage();

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
      <HeroSection systemConfig={systemConfig} t={t} />

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
                  Featured items
                </h2>
                <p className="text-gray-500 text-sm font-medium">
                  Handpicked by our curators
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
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

      {/* Ending Soon Section */}
      <EndingSoonSection endingSoon={endingSoon} />

      {/* Categories */}
      <CategoryGrid t={t} />

      {/* Trust & How It Works */}
      <TrustFeatures t={t} />
    </>
  );
}
