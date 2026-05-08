"use client";

import Image from "next/image";
import { motion, Variants } from "framer-motion";
import {
  Search,
  Sparkles,
  MapPin,
  Bell,
  Zap,
  TrendingUp,
  Shield,
  Gavel,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SystemConfig } from "@/types";
import { useTranslations } from "next-intl";

interface HeroSectionProps {
  systemConfig?: SystemConfig;
  totalUsers?: number;
}

export function HeroSection({ systemConfig, totalUsers }: HeroSectionProps) {
  const t = useTranslations("Home");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/auctions?search=${encodeURIComponent(searchQuery)}`);
    }
  };

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
    <section className="relative overflow-hidden bg-white border-b border-gray-100">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-50/50 rounded-full blur-[120px] -mr-96 -mt-96 opacity-60" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[100px] -ml-40 -mb-40 opacity-40" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pt-24 sm:pb-36">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative z-10"
            >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 border border-primary-100 rounded-full px-4 py-1.5 text-sm font-semibold mb-6 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
              {t("title")}
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="font-heading font-black text-4xl sm:text-6xl lg:text-7xl text-gray-900 leading-[1.1] tracking-tight text-center lg:text-left"
            >
              {systemConfig?.heroTitle ? (
                systemConfig.heroTitle
              ) : (
                <>
                  {t("title")}{" "}
                  <span className="relative inline-block">
                    <span className="relative z-10 text-primary-600 italic bn">
                      {t("marketplace")}
                    </span>
                    <motion.span
                      initial={{ width: 0 }}
                      whileInView={{ width: "100%" }}
                      transition={{ delay: 0.8, duration: 1.2 }}
                      className="absolute bottom-1 sm:bottom-2 left-0 h-2 sm:h-3 bg-primary-100 -z-0 rounded-full"
                    />
                  </span>
                </>
              )}
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-6 text-base sm:text-lg text-gray-500 max-w-xl leading-relaxed font-medium text-center lg:text-left mx-auto lg:mx-0"
            >
              {systemConfig?.heroSubtitle || t("subtitle")}
            </motion.p>

            <motion.form
              variants={itemVariants}
              onSubmit={handleSearch}
              role="search"
              className="mt-10 relative max-w-xl bg-white rounded-2xl shadow-xl shadow-gray-200/50 border-2 border-primary-100 p-2 flex gap-2"
            >
              <label htmlFor="hero-search" className="sr-only">{t("searchPlaceholder")}</label>
              <div className="flex-1 px-4 flex items-center gap-3">
                <Search className="w-5 h-5 text-gray-400" aria-hidden="true" />
                <input
                  id="hero-search"
                  type="search"
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-full bg-transparent focus:outline-none text-gray-900 font-medium placeholder:text-gray-400"
                />
              </div>
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
              >
                {t("searchBtn")}
              </button>
            </motion.form>

            <motion.div
              variants={itemVariants}
              className="mt-8 flex flex-wrap gap-4 text-[13px] font-bold"
            >
              <div className="flex items-center gap-1.5 text-gray-500 glass px-3 py-1.5 rounded-lg border border-gray-100/50 shadow-sm">
                <MapPin className="w-4 h-4 text-primary-500" /> {t("areaFilters")}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 glass px-3 py-1.5 rounded-lg border border-gray-100/50 shadow-sm">
                <Bell className="w-4 h-4 text-orange-500" /> {t("realTimeAlerts")}
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 glass px-3 py-1.5 rounded-lg border border-gray-100/50 shadow-sm">
                <Zap className="w-4 h-4 text-yellow-500" /> {t("antiSnipe")}
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mt-12 flex items-center gap-6 text-gray-400"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="relative w-10 h-10 rounded-full border-2 border-white bg-gray-100 overflow-hidden ring-2 ring-primary-50"
                  >
                    <Image
                      src={`https://i.pravatar.cc/100?u=${i + 10}`}
                      alt="User"
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm font-medium">
                <span className="text-gray-900 font-bold">
                  {totalUsers ? `${(totalUsers / 1000).toFixed(1)}k+` : "2.4k+"}
                </span>{" "}
                {t("activeMembers")}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Visual Composition */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 50 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut" as const }}
            className="hidden lg:block relative"
          >
            <div className="relative z-20 bg-white rounded-[2.5rem] shadow-premium p-6 border border-gray-100/50 rotate-2">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center border border-green-100/50">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 leading-none">
                      {t("liveBidding")}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {t("endingIn")} 02:45:12
                    </span>
                  </div>
                </div>
                <div className="glass text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse shadow-sm">
                  {t("hotDeal")}
                </div>
              </div>

              <div className="aspect-[4/3] bg-gray-50 rounded-2xl mb-6 overflow-hidden relative group border border-gray-100/50">
                <Image
                  src={
                    systemConfig?.heroImage ||
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Dhaka_City_at_Night.jpg/1280px-Dhaka_City_at_Night.jpg"
                  }
                  alt="Auction Item"
                  fill
                  priority
                  className="object-cover group-hover:scale-110 transition-transform duration-700"
                />
                {!systemConfig?.heroImage && (
                  <div className="absolute top-4 right-4 glass px-3 py-1 rounded-full text-xs font-bold text-gray-900 shadow-sm border border-white/50">
                    ৳ 45,000
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">{t("currentPrice")}</span>
                  <span className="font-bold text-primary-600 text-xl tracking-tight">
                    ৳ 45,800
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-4 border-b border-gray-100/60">
                  <span className="text-gray-400">{t("totalBidders")}</span>
                  <span className="font-bold text-gray-700 flex items-center gap-1">
                    <Users className="w-3 h-3 text-primary-500" /> 24 {t("people")}
                  </span>
                </div>
                <button
                  onClick={() => router.push("/auctions")}
                  className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all shadow-lg hover:shadow-black/20"
                >
                  {t("placeYourBid")}
                </button>
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut" as const,
              }}
              className="absolute -top-12 -left-12 z-30 glass border border-white/50 rounded-2xl p-4 shadow-xl -rotate-12"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-2">
                <Gavel className="w-5 h-5 text-primary-600" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                {t("newBid")}
              </div>
              <div className="font-bold text-gray-900 leading-none">
                + ৳ 1,000
              </div>
            </motion.div>

            <motion.div
              animate={{ x: [0, 20, 0] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut" as const,
                delay: 0.5,
              }}
              className="absolute top-1/4 -right-16 z-30 glass border border-white/50 rounded-2xl p-4 shadow-xl shadow-orange-100/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100/80 rounded-full flex items-center justify-center">
                  <Bell className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-xs font-bold text-gray-900 whitespace-nowrap">
                  {t("instantNotify")}
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 20, 0] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut" as const,
                delay: 1,
              }}
              className="absolute -bottom-10 -right-8 z-30 glass border border-white/50 rounded-2xl p-4 shadow-xl rotate-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100/80 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {t("sellerStatus")}
                  </div>
                  <div className="text-xs font-bold text-gray-900">
                    {t("verifiedSeller")}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ scale: [1, 1.05, 1], rotate: [-2, 2, -2] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute -left-20 bottom-12 z-30 glass border border-white/50 rounded-2xl p-4 shadow-xl shadow-primary-100/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100/80 rounded-full flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary-600" />
                </div>
                <div className="text-xs font-bold text-gray-900">
                  {t("areaFilters")}
                </div>
              </div>
            </motion.div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary-100/30 rounded-full blur-[80px] -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
