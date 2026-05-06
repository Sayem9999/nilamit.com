import { getRecommendations } from "@/actions/recommendations";
import AuctionCard from "@/components/auction/AuctionCard";
import type { AuctionWithSeller } from "@/types";
import { Sparkles } from "lucide-react";

export default async function ForYouFeed() {
  try {
    const recommendations = await getRecommendations(3);

    if (!recommendations?.length) return null;

    return (
      <section className="py-12">
        <div className="flex items-center gap-2 mb-8 px-4">
          <div className="p-2 bg-primary-100 rounded-xl">
            <Sparkles className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold text-gray-900">
              Recommended For You
            </h2>
            <p className="text-sm text-gray-500">
              Based on your activity and interests
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
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
