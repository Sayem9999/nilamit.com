"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import AuctionCard from "@/components/auction/AuctionCard";
import { AuctionWithSeller } from "@/types";

interface EndingSoonSectionProps {
  endingSoon: AuctionWithSeller[];
}

export function EndingSoonSection({ endingSoon }: EndingSoonSectionProps) {
  const t = useTranslations("Home");
  if (endingSoon.length === 0) return null;

  return (
    <section className="py-16 sm:py-24 bg-white" aria-labelledby="ending-soon-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-3 mb-10"
        >
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 motion-reduce:animate-none" aria-hidden="true">
            <Clock className="w-6 h-6 animate-pulse motion-reduce:animate-none" />
          </div>
          <div>
            <h2 id="ending-soon-heading" className="font-heading font-black text-3xl sm:text-4xl text-gray-900 tracking-tight">
              {t("endingSoon")}
            </h2>
            <p className="mt-1 text-gray-500 font-medium">
              {t("endingSoonDesc")}
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
          {endingSoon.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      </div>
    </section>
  );
}
