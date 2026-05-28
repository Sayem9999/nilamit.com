"use client";

import { Award, TrendingUp, Trophy } from "lucide-react";
import { calculateLevelProgress } from "@/lib/gamification-engine";
import { motion } from "framer-motion";

interface GamificationStatsProps {
  xp: number;
  level: number;
  streak: number;
}

export default function GamificationStats({ xp, level, streak }: GamificationStatsProps) {
  const progress = calculateLevelProgress(xp);

  return (
    <div className="space-y-6">
      {/* Level & XP Progress */}
      <div className="bg-white border border-gray-100 rounded-md p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4">
           <Trophy className="w-8 h-8 text-amber-500/10 fill-amber-500/5 rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Current Level
              </p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-gray-900 leading-none">
                  {level}
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-tighter">
                  Pro Trader
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Total Experience
              </p>
              <p className="text-xl font-bold text-gray-900 leading-none">
                {xp.toLocaleString()} <span className="text-xs text-gray-400 font-medium">XP</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
               <span className="text-[10px] font-bold text-gray-400 uppercase">Progress to Level {level + 1}</span>
               <span className="text-xs font-bold text-primary-600">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-50 p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Streak Counter */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-md p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-50 rounded-md flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
              Win Streak
            </p>
            <p className="text-lg font-bold text-gray-900 leading-none">
              {streak} <span className="text-[10px] text-orange-600 font-bold tracking-tighter uppercase">Wins</span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-md p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-md flex items-center justify-center">
            <Award className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
              Trust Score
            </p>
            <p className="text-lg font-bold text-gray-900 leading-none">
              A+ <span className="text-[10px] text-blue-600 font-bold tracking-tighter uppercase">Elite</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
