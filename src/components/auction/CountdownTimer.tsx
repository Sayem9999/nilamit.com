"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { formatTimeRemaining } from "@/lib/format";

interface CountdownTimerProps {
  endTime: Date | string;
  serverTime?: Date | string;
  onExpired?: () => void;
  className?: string;
}

export const CountdownTimer = memo(({
  endTime,
  serverTime,
  onExpired,
  className = "",
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
      isUrgent: diff < 60_000,
      isExpired: false,
    };
  }, [endTime, offset]);

  const [state, setState] = useState(computeState);

  useEffect(() => {
    const interval = setInterval(() => {
      const newState = computeState();
      setState(prev => {
        // Only update if the string representation changed to avoid unnecessary re-renders
        if (prev.timeLeft === newState.timeLeft && prev.isUrgent === newState.isUrgent && prev.isExpired === newState.isExpired) {
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

  return (
    <span
      className={`price ${state.isExpired ? "text-gray-400" : state.isUrgent ? "countdown-urgent font-bold" : "text-gray-700"} ${className}`}
    >
      {state.timeLeft}
    </span>
  );
});

CountdownTimer.displayName = "CountdownTimer";
