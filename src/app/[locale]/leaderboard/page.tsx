import Leaderboard from "@/components/social/Leaderboard";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";

export default async function LeaderboardPage() {
  const t = await getTranslations("Leaderboard");

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg text-white">
        <h1 className="text-3xl font-bold mb-2">Platform Champions</h1>
        <p className="opacity-90 max-w-2xl">
          See who is dominating the auctions. Earn badges by participating,
          bidding high, and winning items. Your reputation score builds trust
          across the marketplace.
        </p>
      </div>

      <Leaderboard />
    </div>
  );
}
