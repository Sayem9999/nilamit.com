import { getLeaderboardData } from "@/actions/social";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeList } from "@/components/social/BadgeDisplay";
import { Trophy, Flame, TrendingUp } from "lucide-react";
import { type BadgeType } from "@/lib/gamification-config";
export default async function Leaderboard() {
  const { topStreaks, topBuyers } = await getLeaderboardData();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {/* Highest Streaks */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <CardTitle className="text-lg">Hottest Streaks</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {topStreaks.map((user, idx) => (
              <li key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-800">
                    <AvatarImage src={user.image || ""} referrerPolicy="no-referrer" />
                    <AvatarFallback>
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {user.name || "Anonymous"}
                    </span>
                    <BadgeList
                      badges={user.badges.map((b: { badgeId: string }) => b.badgeId as BadgeType)}
                      className="mt-0.5"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full text-sm font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  {user.winningStreak}
                </div>
              </li>
            ))}
            {topStreaks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No streaks yet. Start winning!
              </p>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Top Buyers */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <CardTitle className="text-lg">Top Rated Members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {topBuyers.map((user, idx) => (
              <li key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-800">
                    <AvatarImage src={user.image || ""} referrerPolicy="no-referrer" />
                    <AvatarFallback>
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {user.name || "Anonymous"}
                    </span>
                    <BadgeList
                      badges={user.badges.map((b: { badgeId: string }) => b.badgeId as BadgeType)}
                      className="mt-0.5"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 px-2.5 py-1 rounded-full text-sm font-bold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {user.rating.toFixed(1)} ★
                </div>
              </li>
            ))}
            {topBuyers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No winners yet. Claim the first victory!
              </p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
