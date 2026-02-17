"use client";

import { motion, Variants } from "framer-motion";
import { TrendingUp, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import AuctionCard from "@/components/auction/AuctionCard";
import { AuctionWithSeller } from "@/types";

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
  return (
    <section className="pb-24 pt-12 bg-white relative">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-primary-600 bg-primary-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
              <TrendingUp className="w-4 h-4" /> Trending Now
            </div>
            <h2 className="font-heading font-black text-4xl sm:text-5xl text-gray-900 tracking-tight">
              Most <span className="text-primary-600">Popular</span> Bids
            </h2>
          </div>
          <Link
            href="/auctions?sortBy=bids&sortOrder=desc"
            className="group flex items-center gap-2 bg-gray-50 hover:bg-primary-50 text-gray-900 hover:text-primary-700 px-6 py-3 rounded-2xl font-bold transition-all border border-gray-100"
          >
            View More{" "}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {trendingAuctions.length === 0 ? (
          <div className="bg-gray-50/50 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-100">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">
              Bidding is just heating up! No auctions are trending yet.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8"
          >
            {trendingAuctions.slice(0, 4).map((auction) => (
              <motion.div key={auction.id} variants={itemVariants}>
                <AuctionCard auction={auction} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
