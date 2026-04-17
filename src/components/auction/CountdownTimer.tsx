"use client";

import { useState, useEffect, useCallback } from "react";
import { formatTimeRemaining } from "@/lib/format";

interface CountdownTimerProps {
  endTime: Date | string;
  onExpired?: () => void;
  className?: string;
}

export function CountdownTimer({
  endTime,
  onExpired,
  className = "",
}: CountdownTimerProps) {
  const computeState = useCallback(() => {
    const end = new Date(endTime);
    const diff = end.getTime() - Date.now();
    if (diff <= 0)
      return { timeLeft: "Ended", isUrgent: false, isExpired: true };
    return {
      timeLeft: formatTimeRemaining(endTime),
      isUrgent: diff < 60_000,
      isExpired: false,
    };
  }, [endTime]);

  const initial = computeState();
  const [timeLeft, setTimeLeft] = useState(initial.timeLeft);
  const [isUrgent, setIsUrgent] = useState(initial.isUrgent);
  const [isExpired, setIsExpired] = useState(initial.isExpired);

  useEffect(() => {
    const tick = () => {
      const s = computeState();
      setTimeLeft(s.timeLeft);
      setIsUrgent(s.isUrgent);
      if (s.isExpired) {
        setIsExpired(true);
        onExpired?.();
      }
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [computeState, onExpired]);

  return (
    <span
      role="timer"
      aria-live={isUrgent ? "assertive" : "off"}
      aria-atomic="true"
      aria-label={isExpired ? "Auction ended" : `Time remaining: ${timeLeft}`}
      className={`price ${isExpired ? "text-gray-400" : isUrgent ? "countdown-urgent font-bold" : "text-gray-700"} ${className}`}
    >
      {timeLeft}
    </span>
  );
}
