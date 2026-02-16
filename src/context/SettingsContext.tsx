'use client';

import React, { createContext, useContext, useState } from 'react';

interface SettingsContextType {
  lightweightMode: boolean;
  setLightweightMode: (value: boolean) => void;
  toggleLightweightMode: () => void;
  soundEffectsEnabled: boolean;
  toggleSoundEffects: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lightweightMode, setLightweightMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lightweightMode') === 'true';
  });

  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('soundEffectsEnabled') !== 'false';
  });

  const toggleLightweightMode = () => {
    const newValue = !lightweightMode;
    setLightweightMode(newValue);
    localStorage.setItem('lightweightMode', String(newValue));
  };

  const toggleSoundEffects = () => {
    const newValue = !soundEffectsEnabled;
    setSoundEffectsEnabled(newValue);
    localStorage.setItem('soundEffectsEnabled', String(newValue));
  };

  return (
    <SettingsContext.Provider value={{ 
      lightweightMode, 
      setLightweightMode, 
      toggleLightweightMode,
      soundEffectsEnabled,
      toggleSoundEffects
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
