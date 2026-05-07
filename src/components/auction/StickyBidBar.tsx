'use client';

import { useState, useEffect } from 'react';
import { formatBDT } from '@/lib/format';
import { TrendingUp, Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownTimer } from './CountdownTimer';
import { Clock } from 'lucide-react';

interface StickyBidBarProps {
  currentPrice: number;
  endTime: Date | string;
  serverTime?: Date | string;
  targetId: string;
}

export function StickyBidBar({ currentPrice, endTime, serverTime, targetId }: StickyBidBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 300px, or if the main bid panel is not in view
      const scrollY = window.scrollY;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        // Hide if the main bid panel is visible on screen
        const isTargetVisible = rect.top < window.innerHeight && rect.bottom > 0;
        setIsVisible(scrollY > 400 && !isTargetVisible);
      } else {
        setIsVisible(scrollY > 400);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [targetId]);

  const scrollToBid = () => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          aria-label="Quick bid bar"
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden p-4"
        >
          <div className="bg-white/90 backdrop-blur-xl border border-gray-100 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-0.5">
                <TrendingUp className="w-3 h-3" aria-hidden="true" /> Current Bid
              </div>
              <div className="flex items-center gap-2">
                <div className="price text-xl text-gray-900 font-bold whitespace-nowrap">
                  {formatBDT(currentPrice)}
                </div>
                <div className="h-4 w-[1px] bg-gray-200" aria-hidden="true" />
                <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <CountdownTimer endTime={endTime} serverTime={serverTime} className="!text-[11px] tabular-nums" />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={scrollToBid}
              aria-label="Jump to bid panel"
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary-200 active:scale-95 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
            >
              <Gavel className="w-4 h-4" aria-hidden="true" />
              Bid Now
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
