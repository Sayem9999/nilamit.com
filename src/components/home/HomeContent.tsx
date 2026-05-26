"use client";

import { useTranslations } from "next-intl";

import { Variants } from "framer-motion";
import { Megaphone, Star, DollarSign, ShieldCheck, Sparkles } from "lucide-react";
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

  const commissionEnabled = systemConfig?.commissionPercentageEnabled ?? true;
  const customPercentage = systemConfig?.commissionPercentage;
  const escrowRequired = systemConfig?.escrowRequired ?? true;

  let dynamicCommissionText = "a small seller commission";
  let dynamicUpfrontCostTitle = "0% Upfront Cost";
  let dynamicUpfrontCostDesc = "List as many pre-loved gadgets, bikes, or fashion items as you want without paying a single paisa.";

  if (!commissionEnabled || customPercentage === 0) {
    dynamicCommissionText = "0% seller commission";
    dynamicUpfrontCostTitle = "৳0 Successful Sale Fee";
    dynamicUpfrontCostDesc = "Enjoy completely free trading with 0% listing, 0% bidding, and 0% successful sale commission fees.";
  } else if (customPercentage !== undefined && customPercentage !== null) {
    dynamicCommissionText = `a small ${customPercentage}% seller commission`;
    dynamicUpfrontCostTitle = `${customPercentage}% Seller Fee`;
    dynamicUpfrontCostDesc = `No listing or bidding fees. Only pay a tiny ${customPercentage}% commission when your trade successfully completes.`;
  } else {
    // Standard tiers
    dynamicCommissionText = "a low 1% - 2.5% seller commission";
    dynamicUpfrontCostTitle = "Low Commission";
    dynamicUpfrontCostDesc = "No upfront fees. Standard seller commission starts from 1% to 2.5% only on successful auction endings.";
  }

  const dynamicDeliveryConfirmText = escrowRequired 
    ? "and the buyer confirms delivery" 
    : "upon successful handover coordination";

  const dynamicEscrowTitle = escrowRequired 
    ? "Escrow Treasury Guard" 
    : "Direct Neighborhood Trade";
  const dynamicEscrowDesc = escrowRequired 
    ? "Payments are held securely in Nilamit Escrow and only released when the buyer confirms receipt." 
    : "Escrow is disabled. Coordinate local pickups and handovers directly with buyers and sellers near you.";

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
        <aside aria-label="Site announcement" className="bg-indigo-650 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
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

      {/* ৳0 Listing Fee & Escrow Reassurance Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-primary-700 to-blue-800 p-8 sm:p-10 shadow-premium text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_45%)]" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px]" />
          
          <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-amber-300">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Community First Marketplace
              </div>
              <h3 className="font-heading font-black text-3xl sm:text-4xl tracking-tight leading-none text-white">
                ৳0 Listing Fee • ৳0 Bidding Fee
              </h3>
              <p className="text-primary-100 max-w-xl text-sm sm:text-base leading-relaxed">
                Nilamit is 100% free to list items and place bids. We only charge {dynamicCommissionText} if and when your trade successfully completes {dynamicDeliveryConfirmText}.
              </p>
            </div>
            
            <div className="lg:col-span-5 grid sm:grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300">
                <div className="w-10 h-10 bg-amber-400/20 rounded-xl flex items-center justify-center mb-3">
                  <DollarSign className="w-5 h-5 text-amber-300" />
                </div>
                <h4 className="font-bold text-white text-sm mb-1">{dynamicUpfrontCostTitle}</h4>
                <p className="text-xs text-primary-200">{dynamicUpfrontCostDesc}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300">
                <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5 text-green-300" />
                </div>
                <h4 className="font-bold text-white text-sm mb-1">{dynamicEscrowTitle}</h4>
                <p className="text-xs text-primary-200">{dynamicEscrowDesc}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Top Rated Sellers Showcase */}
      <TopSellersShowcase sellers={topSellers} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Ending Soon Section */}
        <EndingSoonSection endingSoon={endingSoon} />

        {/* Categories */}
        <CategoryGrid />
        
        {/* Area Hyper-localization */}
        <AreaQuickLinks locale={locale} />
      </div>

      {/* Trust & How It Works */}
      <TrustFeatures systemConfig={systemConfig} />
    </>
  );
}
