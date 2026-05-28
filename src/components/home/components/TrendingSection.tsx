"use client";

import { motion, Variants } from "framer-motion";
import { TrendingUp, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import AuctionCard from "@/components/auction/AuctionCard";
import { AuctionWithSeller } from "@/types";
import { useTranslations } from "next-intl";

interface TrendingSectionProps {
  trendingAuctions: AuctionWithSeller[];
  containerVariants: Variants;
  itemVariants: Variants;
}

export function TrendingSection({
  trendingAuctions,
  containerVariants,
  itemVariants,
}: TrendingSectionProps) {
  const t = useTranslations("Home");
  return (
    <section
      aria-labelledby="trending-heading"
      className="py-8 sm:py-10 bg-white"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-rose-100 rounded-md flex items-center justify-center text-rose-600" aria-hidden="true">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="trending-heading"
                className="font-heading font-black text-xl sm:text-2xl text-gray-900 tracking-tight leading-none"
              >
                {t("trendingTitle")}
              </h2>
              <p className="text-[12px] text-gray-500 mt-1 uppercase tracking-widest font-bold">
                {t("trendingTag")}
              </p>
            </div>
          </div>
          <Link
            href="/auctions?sortBy=bids&sortOrder=desc"
            aria-label={`${t("viewMore")} — most active auctions`}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700 hover:gap-2 transition-all"
          >
            {t("viewMore")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {trendingAuctions.length === 0 ? (
          <div className="bg-gray-50 rounded-md p-10 text-center border border-dashed border-gray-200">
            <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-500 text-sm font-medium">{t("noTrending")}</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5"
          >
            {trendingAuctions.slice(0, 4).map((auction, idx) => (
              <motion.div key={auction.id} variants={itemVariants}>
                <AuctionCard auction={auction} priority={idx < 2} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
