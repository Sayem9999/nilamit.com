import { getRecommendations } from "@/actions/recommendations";
import AuctionCard from "@/components/auction/AuctionCard";
import type { AuctionWithSeller } from "@/types";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function ForYouFeed() {
  try {
    const recommendations = await getRecommendations(3);
    if (!recommendations?.length) return null;

    const t = await getTranslations("ForYou");

    return (
      <section className="py-12" aria-labelledby="for-you-heading">
        <div className="flex items-center gap-2 mb-8 px-4">
          <div className="p-2 bg-primary-100 rounded-md" aria-hidden="true">
            <Sparkles className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 id="for-you-heading" className="text-2xl font-heading font-bold text-gray-900">
              {t("title")}
            </h2>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 px-4">
          {recommendations.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction as unknown as AuctionWithSeller}
            />
          ))}
        </div>
      </section>
    );
  } catch (error) {
    console.error("[ForYouFeed] Error fetching recommendations:", error);
    return null;
  }
}
