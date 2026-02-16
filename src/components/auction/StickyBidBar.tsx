'use client';

import { useState, useEffect } from 'react';
import { formatBDT } from '@/lib/format';
import { TrendingUp, Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StickyBidBarProps {
  currentPrice: number;
  targetId: string;
}

export function StickyBidBar({ currentPrice, targetId }: StickyBidBarProps) {
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
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden p-4"
        >
          <div className="bg-white/90 backdrop-blur-xl border border-gray-100 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-[10px] font-bold text-primary-600 uppercase tracking-widest">
                <TrendingUp className="w-3 h-3" /> Current Bid
              </div>
              <div className="price text-xl text-gray-900 font-bold">
                {formatBDT(currentPrice)}
              </div>
            </div>
            
            <button
              onClick={scrollToBid}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Gavel className="w-4 h-4" />
              Bid Now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
