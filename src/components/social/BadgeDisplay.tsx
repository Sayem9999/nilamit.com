import React from "react";
import { BADGE_CONFIG, BadgeType } from "@/lib/gamification-config";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BadgeDisplayProps {
  badgeId: BadgeType;
  className?: string;
}

export function BadgeDisplay({ badgeId, className }: BadgeDisplayProps) {
  const config = BADGE_CONFIG[badgeId];

  if (!config) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm cursor-help hover:scale-110 transition-transform",
              className,
            )}
            aria-label={config.name}
          >
            <span className="text-sm select-none" role="img" aria-hidden="true">
              {config.icon}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-center font-medium">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {config.name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[150px]">
            {config.description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BadgeList({
  badges,
  className,
}: {
  badges: BadgeType[];
  className?: string;
}) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((b) => (
        <BadgeDisplay key={b} badgeId={b} />
      ))}
    </div>
  );
}
