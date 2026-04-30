"use client";

import React, { memo } from "react";
import { CheckCircle2, ShieldCheck, Building2, Phone, Mail, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerificationBadgeProps {
  isPhoneVerified: boolean;
  emailVerified: Date | string | null;
  isVerifiedSeller: boolean;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VerificationBadge = memo(({
  isPhoneVerified,
  emailVerified,
  isVerifiedSeller,
  showText = true,
  size = "md",
  className = "",
}: VerificationBadgeProps) => {
  const t = useTranslations("Social");

  let level = 0;
  if (isPhoneVerified) level = 1;
  if (isPhoneVerified && emailVerified) level = 2;
  if (isPhoneVerified && emailVerified && isVerifiedSeller) level = 3;

  const getConfig = () => {
    switch (level) {
      case 3:
        return {
          label: t("verif_Business"),
          color: "from-purple-500 to-indigo-600",
          textColor: "text-purple-700 dark:text-purple-300",
          bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
          icon: <Building2 className="w-full h-full" />,
          desc: t("verif_Business_Desc"),
          details: [<Phone key="1"/>, <Mail key="2"/>, <Building2 key="3"/>],
        };
      case 2:
        return {
          label: t("verif_Email"),
          color: "from-blue-500 to-cyan-600",
          textColor: "text-blue-700 dark:text-blue-300",
          bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
          icon: <ShieldCheck className="w-full h-full" />,
          desc: t("verif_Email_Desc"),
          details: [<Phone key="1"/>, <Mail key="2"/>],
        };
      case 1:
        return {
          label: t("verif_Phone"),
          color: "from-emerald-500 to-green-600",
          textColor: "text-emerald-700 dark:text-emerald-300",
          bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
          icon: <CheckCircle2 className="w-full h-full" />,
          desc: t("verif_Phone_Desc"),
          details: [<Phone key="1"/>],
        };
      default:
        return {
          label: t("verif_Unverified"),
          color: "from-slate-400 to-slate-500",
          textColor: "text-slate-600 dark:text-slate-400",
          bgColor: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
          icon: <Info className="w-full h-full" />,
          desc: t("verif_Unverified_Desc"),
          details: [],
        };
    }
  };

  const config = getConfig();

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
              inline-flex items-center font-bold tracking-tight rounded-full border shadow-sm
              transition-all duration-300 hover:scale-105 active:scale-95
              ${config.bgColor} ${config.textColor} ${sizeClasses[size]} ${className}
            `}
          >
            <div className={`relative ${iconSize[size]}`}>
              <div className={`absolute inset-0 animate-pulse blur-[3px] opacity-20 bg-gradient-to-r ${config.color} rounded-full`} />
              <div className="relative text-current">
                {config.icon}
              </div>
            </div>
            {showText && <span className="bn">{config.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-100 dark:border-slate-800 rounded-2xl shadow-premium max-w-[220px]">
          <div className="space-y-3">
            <p className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2 bn">
              {config.icon} <span className="w-4 h-4" /> {config.label}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed bn">
              {config.desc}
            </p>
            {config.details.length > 0 && (
              <div className="flex gap-2 pt-1">
                {config.details.map((icon, i) => (
                  <div key={i} className={`p-1.5 rounded-full bg-gradient-to-br ${config.color} text-white`}>
                    <div className="w-3 h-3 flex items-center justify-center">
                      {icon}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

VerificationBadge.displayName = "VerificationBadge";
export default VerificationBadge;
