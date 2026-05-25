"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { formatTimeRemaining } from "@/lib/format";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  endTime: Date | string;
  serverTime?: Date | string;
  onExpired?: () => void;
  className?: string;
  variant?: "inline" | "badge" | "card-footer" | "sticky-bar";
}

export const CountdownTimer = memo(({
  endTime,
  serverTime,
  onExpired,
  className = "",
  variant = "inline",
}: CountdownTimerProps) => {
  // Calculate offset once on mount to adjust for client/server clock drift
  const [offset] = useState(() => {
    if (!serverTime) return 0;
    return new Date(serverTime).getTime() - Date.now();
  });

  const computeState = useCallback(() => {
    const end = new Date(endTime);
    const now = Date.now() + offset;
    const nowObj = new Date(now);
    const diff = end.getTime() - now;
    
    if (diff <= 0) {
      return { timeLeft: "Ended", isUrgent: false, isExpired: true };
    }
    
    return {
      timeLeft: formatTimeRemaining(endTime, nowObj),
      isUrgent: diff < 120_000, // Urgent is defined as < 2 minutes (anti-snipe window)
      isExpired: false,
    };
  }, [endTime, offset]);

  const [state, setState] = useState(computeState);

  useEffect(() => {
    const interval = setInterval(() => {
      const newState = computeState();
      setState(prev => {
        // Only update if the state has actually changed to avoid unnecessary re-renders
        if (
          prev.timeLeft === newState.timeLeft &&
          prev.isUrgent === newState.isUrgent &&
          prev.isExpired === newState.isExpired
        ) {
          return prev;
        }
        return newState;
      });

      if (newState.isExpired) {
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [computeState, onExpired]);

  // Render for Card Footer variant
  if (variant === "card-footer") {
    const hasWidth = className.includes("w-");
    return (
      <div
        className={`${hasWidth ? "" : "w-full"} flex items-center justify-center gap-2 py-2 px-3 rounded-2xl border transition-all duration-500 font-mono tracking-tight text-xs font-bold ${
          state.isExpired
            ? "bg-gray-100/60 border-gray-200 text-gray-400"
            : state.isUrgent
            ? "bg-red-50/80 border-red-200/60 text-red-600 shadow-sm shadow-red-500/10 backdrop-blur-md animate-pulse"
            : "bg-gray-50/80 border-gray-100/80 text-gray-500 group-hover:bg-primary-50 group-hover:border-primary-100/50 group-hover:text-primary-600"
        } ${className}`}
      >
        <Clock
          className={`w-3.5 h-3.5 transition-transform duration-500 ${
            state.isExpired
              ? "text-gray-300"
              : state.isUrgent
              ? "text-red-500 animate-spin [animation-duration:8s]"
              : "text-gray-400 group-hover:text-primary-500"
          }`}
          aria-hidden="true"
        />
        <span>{state.timeLeft}</span>
      </div>
    );
  }

  // Render for Badge variant (typically used in Detail page headers)
  if (variant === "badge") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all duration-500 font-mono text-sm shadow-sm backdrop-blur-md ${
          state.isExpired
            ? "bg-gray-100/80 border-gray-200 text-gray-400"
            : state.isUrgent
            ? "bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30 text-red-600 shadow-[0_0_15px_rgba(239,68,68,0.08)] animate-pulse font-black"
            : "bg-slate-50/80 border-slate-200/60 text-slate-700 font-bold"
        } ${className}`}
      >
        {state.isExpired ? (
          <span className="h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />
        ) : (
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                state.isUrgent ? "bg-red-400" : "bg-primary-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                state.isUrgent ? "bg-red-500" : "bg-primary-500"
              }`}
            />
          </span>
        )}
        <span>{state.timeLeft}</span>
      </div>
    );
  }

  // Default / Inline Variant
  return (
    <span
      className={`inline-flex items-center gap-1.5 transition-all duration-300 ${
        state.isExpired
          ? "text-gray-400 font-medium"
          : state.isUrgent
          ? "text-red-600 font-bold animate-pulse"
          : "text-gray-700 font-semibold"
      } ${className}`}
    >
      {!state.isExpired && state.isUrgent && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
      )}
      {state.timeLeft}
    </span>
  );
});

CountdownTimer.displayName = "CountdownTimer";

