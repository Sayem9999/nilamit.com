"use client";

import { ShieldCheck, Award, Star, Zap, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TrustBadgeProps {
  score: number;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function TrustBadge({
  score,
  showText = true,
  size = "md",
  className = "",
}: TrustBadgeProps) {
  const t = useTranslations("Social");

  // Tier Mapping
  const getTier = (s: number) => {
    if (s >= 500) return { 
      label: t("tier_Legend"), 
      color: "from-amber-400 via-yellow-500 to-orange-500", 
      icon: <Award className="w-full h-full" />,
      textColor: "text-amber-700",
      bgColor: "bg-amber-50"
    };
    if (s >= 250) return { 
      label: t("tier_Elite"), 
      color: "from-slate-400 to-slate-600", 
      icon: <Zap className="w-full h-full" />,
      textColor: "text-slate-700",
      bgColor: "bg-slate-50"
    };
    if (s >= 100) return { 
      label: t("tier_Trusted"), 
      color: "from-blue-400 to-blue-600", 
      icon: <ShieldCheck className="w-full h-full" />,
      textColor: "text-blue-700",
      bgColor: "bg-blue-50"
    };
    return { 
      label: t("tier_New"), 
      color: "from-emerald-400 to-emerald-600", 
      icon: <Star className="w-full h-full" />,
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50"
    };
  };

  const tier = getTier(score);

  const sizeClasses = {
    sm: "h-5 text-[10px] gap-1 px-1.5",
    md: "h-7 text-xs gap-1.5 px-2.5",
    lg: "h-9 text-sm gap-2 px-4",
  };

  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              inline-flex items-center font-bold tracking-tight rounded-full border border-white/20 shadow-sm
              bg-gradient-to-br transition-all duration-300 hover:scale-105 active:scale-95
              ${tier.bgColor} ${tier.textColor} ${sizeClasses[size]} ${className}
            `}
          >
            <div className={`relative ${iconSize[size]}`}>
              <div className={`absolute inset-0 animate-pulse blur-[4px] opacity-40 bg-gradient-to-r ${tier.color} rounded-full`} />
              <div className="relative">
                {tier.icon}
              </div>
            </div>
            {showText && <span className="bn">{tier.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-3 bg-white/95 backdrop-blur-md border-slate-100 rounded-2xl shadow-premium max-w-[200px]">
          <div className="space-y-2">
            <p className="font-bold text-slate-900 border-b border-slate-50 pb-1 flex items-center gap-2 bn">
              <Info className="w-3.5 h-3.5 text-blue-500" /> {t("trustScore")}: {score}
            </p>
            <p className="text-[10px] text-slate-500 leading-relaxed italic bn">
              {t("reputationDescription")}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
