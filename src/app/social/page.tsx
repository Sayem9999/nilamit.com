import { getUserReputation, getUserConversations } from "@/actions/social";
import ChatList from "@/components/social/ChatList";
import UserBadge from "@/components/social/UserBadge";
import Image from "next/image";
import { getProxiedAvatarUrl } from "@/lib/avatar";
import { auth } from "@/lib/auth";
import { User, Trophy, ShieldCheck } from "lucide-react";

export default async function SocialDashboardPage() {
  const _session = await auth();
  const [reputation, conversations] = await Promise.all([
    getUserReputation(),
    getUserConversations()
  ]);

  if (!reputation) return <div>Please login.</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left: Reputation Card */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white border border-gray-100 rounded-[40px] p-8 shadow-premium text-center">
              <div className="w-24 h-24 bg-primary-50 rounded-full mx-auto mb-6 flex items-center justify-center relative">
                {reputation.image ? (
                  <Image
                    src={getProxiedAvatarUrl(reputation.image) || ""}
                    alt={reputation.name || ""}
                    fill
                    sizes="96px"
                    className="rounded-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-primary-400" />
                )}
                <div className="absolute -bottom-1 -right-1 bg-green-500 border-4 border-white w-8 h-8 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
              </div>

              <h1 className="text-2xl font-heading font-bold text-gray-900 mb-1">
                {reputation.name}
              </h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-6">
                Active Trader
              </p>

              <div className="flex flex-col gap-3 items-center">
                <UserBadge
                  level={reputation.userLevel}
                  streak={reputation.winningStreak}
                  rating={reputation.rating}
                  ratingCount={reputation.ratingCount}
                />
              </div>

              <div className="mt-10 grid grid-cols-1 gap-4">
                <div className="p-4 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                    Win Streak
                  </p>
                  <p className="text-xl font-bold text-gray-900">{reputation.winningStreak}</p>
                </div>
              </div>

              <button className="w-full mt-8 py-4 bg-gray-900 text-white rounded-md font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" /> Hall of Fame
              </button>
            </div>
          </div>

          {/* Right: Coordination Hub */}
          <div className="flex-1">
            <ChatList conversations={conversations} />
          </div>
        </div>
      </div>
    </div>
  );
}
