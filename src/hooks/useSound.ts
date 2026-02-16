'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/context/SettingsContext';

export function useSound(url: string) {
  const { soundEffectsEnabled } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUnlockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const audio = new Audio(url);
    audio.preload = 'auto';
    audioRef.current = audio;

    // Unlocking strategy for mobile browsers
    const unlock = () => {
      if (isUnlockedRef.current || !audioRef.current) return;
      
      // Play a silent sound to unlock the context
      audioRef.current.play()
        .then(() => {
          audioRef.current!.pause();
          audioRef.current!.currentTime = 0;
          isUnlockedRef.current = true;
          window.removeEventListener('click', unlock);
          window.removeEventListener('touchstart', unlock);
        })
        .catch(e => console.log('Audio unlock waiting for gesture...', e));
    };

    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [url]);

  const play = useCallback(() => {
    if (!soundEffectsEnabled || !audioRef.current) return;

    // Reset and play
    audioRef.current.currentTime = 0;
    audioRef.current.volume = 0.5;
    audioRef.current.play().catch(e => {
      console.warn('Audio play failed (might be blocked by browser):', e);
    });
  }, [soundEffectsEnabled]);

  return { play };
}
