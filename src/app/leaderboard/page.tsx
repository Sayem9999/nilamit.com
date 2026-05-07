import Leaderboard from "@/components/social/Leaderboard";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const t = await getTranslations("Leaderboard");

  return (
    <main className="min-h-screen bg-gray-50/50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header
          aria-labelledby="leaderboard-heading"
          className="mb-12 p-10 bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-900 rounded-[3rem] shadow-2xl text-white relative overflow-hidden"
        >
          <div
            className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px]"
            aria-hidden="true"
          />
          <h1
            id="leaderboard-heading"
            className="text-4xl md:text-5xl font-heading font-bold mb-4 relative z-10"
          >
            {t("title")}
          </h1>
          <p className="text-lg opacity-80 max-w-2xl leading-relaxed relative z-10">
            {t("subtitle")}
          </p>
        </header>

        <Leaderboard />
      </div>
    </main>
  );
}
