"use client";

import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
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
    <section
      aria-labelledby="ending-soon-heading"
      className="py-8 sm:py-10 bg-gray-50/60 border-y border-gray-100"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-red-100 rounded-md flex items-center justify-center text-red-600" aria-hidden="true">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="ending-soon-heading"
                className="font-heading font-black text-xl sm:text-2xl text-gray-900 tracking-tight leading-none"
              >
                {t("endingSoon")}
              </h2>
              <p className="text-[12px] text-gray-500 mt-1">{t("endingSoonDesc")}</p>
            </div>
          </div>
          <Link
            href="/auctions?sortBy=endTime&sortOrder=asc"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:text-primary-700 hover:gap-2 transition-all"
          >
            {t("seeAll")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {endingSoon.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      </div>
    </section>
  );
}
