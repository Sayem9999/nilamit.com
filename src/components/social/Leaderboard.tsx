import { getLeaderboardData } from "@/actions/social";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeList } from "@/components/social/BadgeDisplay";
import { Trophy, TrendingUp, ShoppingBag, Star } from "lucide-react";
import { type BadgeType } from "@/lib/gamification-config";

export default async function Leaderboard() {
  const { topMerchants, topTrusted } = await getLeaderboardData();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {/* Top Volume Merchants */}
      <Card className="border border-slate-100 shadow-xs">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <ShoppingBag className="w-5 h-5 text-primary-600" />
          <CardTitle className="text-lg font-heading font-bold text-slate-800">Top Volume Merchants</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {topMerchants.map((user, idx) => (
              <li key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <Avatar className="w-10 h-10 border border-slate-200">
                    <AvatarImage src={user.image || ""} referrerPolicy="no-referrer" />
                    <AvatarFallback className="font-semibold text-primary-700 bg-primary-50">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">
                      {user.name || "Anonymous"}
                    </span>
                    <BadgeList
                      badges={user.badges.map((b: { badgeId: string }) => b.badgeId as BadgeType)}
                      className="mt-0.5"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-xs font-bold border border-primary-100">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {user.salesCount} Trades
                </div>
              </li>
            ))}
            {topMerchants.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No active merchant listings completed yet.
              </p>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Top Rated Traders */}
      <Card className="border border-slate-100 shadow-xs">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg font-heading font-bold text-slate-800">Top Rated Traders</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {topTrusted.map((user, idx) => (
              <li key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <Avatar className="w-10 h-10 border border-slate-200">
                    <AvatarImage src={user.image || ""} referrerPolicy="no-referrer" />
                    <AvatarFallback className="font-semibold text-amber-700 bg-amber-50">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">
                      {user.name || "Anonymous"}
                    </span>
                    <BadgeList
                      badges={user.badges.map((b: { badgeId: string }) => b.badgeId as BadgeType)}
                      className="mt-0.5"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-100">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {user.rating.toFixed(1)} ★
                  {user.ratingCount > 0 && (
                    <span className="text-[10px] text-amber-600 font-normal">({user.ratingCount})</span>
                  )}
                </div>
              </li>
            ))}
            {topTrusted.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No rated traders available yet.
              </p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
