"use client";

import { useTranslations } from "next-intl";

import { Variants } from "framer-motion";
import { Megaphone, Star } from "lucide-react";
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
        <aside aria-label="Site announcement" className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <Megaphone className="w-4 h-4 animate-bounce motion-reduce:animate-none" aria-hidden="true" />
          {systemConfig.announcement}
        </aside>
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

      {/* Featured Auctions — Premium Curator's Choice */}
      {featuredAuctions.length > 0 && (
        <section className="py-24 relative overflow-hidden bg-slate-950 dark" style={{ backgroundColor: '#020617' }} aria-labelledby="featured-heading">
          {/* Animated Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/2 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-amber-400" />
                  Curator&apos;s Choice
                </div>
                <h2 id="featured-heading" className="font-heading font-black text-4xl md:text-5xl text-white tracking-tight">
                  {t("featuredTitle")}
                </h2>
                <p className="text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
                  {t("featuredSubtitle")}
                </p>
              </div>
              
              <div className="hidden md:block">
                <div className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-white/60 text-sm">
                  Showing <span className="text-amber-400 font-bold">{featuredAuctions.length}</span> handpicked items
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {featuredAuctions.map((auction, idx) => (
                <div key={auction.id} className="group relative transition-all duration-500 hover:-translate-y-2">
                  {/* Premium Gold/Amber Glow behind card on hover */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-primary-600/10 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                  
                  <AuctionCard 
                    auction={auction} 
                    priority={idx < 4} 
                    className="featured h-full border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-amber-500/30 transition-all shadow-[0_0_30px_-15px_rgba(245,158,11,0.1)] hover:shadow-[0_15px_40px_rgba(245,158,11,0.15)] duration-500"
                  />
                </div>
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
