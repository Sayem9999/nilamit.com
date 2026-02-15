'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatTimeRemaining } from '@/lib/format';

interface CountdownTimerProps {
  endTime: Date | string;
  onExpired?: () => void;
  className?: string;
}

export function CountdownTimer({ endTime, onExpired, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const updateTimer = useCallback(() => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeLeft('Ended');
      setIsExpired(true);
      onExpired?.();
      return;
    }

    setIsUrgent(diff < 60 * 1000); // Less than 1 minute
    setTimeLeft(formatTimeRemaining(endTime));
  }, [endTime, onExpired]);

  useEffect(() => {
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  return (
    <span
      className={`price ${isExpired ? 'text-gray-400' : isUrgent ? 'countdown-urgent font-bold' : 'text-gray-700'} ${className}`}
    >
      {timeLeft}
    </span>
  );
}
