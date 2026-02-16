'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SettingsContextType {
  lightweightMode: boolean;
  setLightweightMode: (value: boolean) => void;
  toggleLightweightMode: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lightweightMode, setLightweightMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('lightweightMode') === 'true';
  });

  const toggleLightweightMode = () => {
    const newValue = !lightweightMode;
    setLightweightMode(newValue);
    localStorage.setItem('lightweightMode', String(newValue));
  };

  return (
    <SettingsContext.Provider value={{ lightweightMode, setLightweightMode, toggleLightweightMode }}>
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
