import { Trophy, Star, ChevronUp, ShieldCheck } from "lucide-react";

interface UserBadgeProps {
  level: number;
  streak: number;
  rating: number;
  ratingCount?: number;
  isVerified?: boolean;
  className?: string;
}

export default function UserBadge({
  level,
  streak,
  rating,
  ratingCount = 0,
  isVerified = false,
  className = "",
}: UserBadgeProps) {
  // Level color mapping
  const getLevelColor = (lv: number) => {
    if (lv >= 50) return "text-purple-600 bg-purple-50 border-purple-100";
    if (lv >= 20) return "text-blue-600 bg-blue-50 border-blue-100";
    if (lv >= 10) return "text-green-600 bg-green-50 border-green-100";
    return "text-gray-600 bg-gray-50 border-gray-100";
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Verified Badge */}
      {isVerified && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[11px] font-bold uppercase tracking-tight">
          <ShieldCheck className="w-2.5 h-2.5 fill-blue-600/10" />
          Verified
        </div>
      )}

      {/* Level Badge */}
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-tight ${getLevelColor(level)}`}
      >
        <ChevronUp className="w-2.5 h-2.5" />
        Lvl {level}
      </div>

      {/* Winning Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[11px] font-bold uppercase tracking-tight">
          <Trophy className="w-2.5 h-2.5" />
          {streak} Win Streak
        </div>
      )}

      {/* Feedback Rating */}
      <div className="flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-600 border border-primary-100 rounded-full text-[11px] font-bold uppercase tracking-tight">
        <Star className="w-2.5 h-2.5 fill-primary-600/10 text-amber-500 fill-amber-500/20 border-amber-300" />
        {ratingCount > 0 ? `${rating.toFixed(1)} ★ (${ratingCount})` : 'No reviews'}
      </div>
    </div>
  );
}
