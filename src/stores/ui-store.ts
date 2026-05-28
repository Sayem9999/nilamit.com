"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Global UI preferences store (Zustand).
 *
 * Use this for cross-page UI state that survives navigation but isn't worth
 * a React Context. Keep auth state in NextAuth and server-derived data in
 * Server Actions; this store is purely client-side ergonomics.
 *
 * Persisted to localStorage so a returning user gets their last preferences.
 * SSR-safe: hydrates on mount via persist middleware.
 */

export type Theme = "light" | "dark" | "system";
export type UILocale = "en" | "bn";

interface UIState {
  theme: Theme;
  locale: UILocale;
  lightweightMode: boolean;
  /** Dashboard sidebar collapsed (desktop only). */
  sidebarCollapsed: boolean;
  /** "Tip seen" map keyed by tip ID — for one-time hint banners. */
  tipsSeen: Record<string, true>;

  setTheme: (theme: Theme) => void;
  setLocale: (locale: UILocale) => void;
  setLightweightMode: (enabled: boolean) => void;
  toggleSidebar: () => void;
  markTipSeen: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "light",
      locale: "en",
      lightweightMode: false,
      sidebarCollapsed: false,
      tipsSeen: {},

      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setLightweightMode: (lightweightMode) => set({ lightweightMode }),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      markTipSeen: (id) =>
        set((s) => ({ tipsSeen: { ...s.tipsSeen, [id]: true } })),
    }),
    {
      name: "nilamit-ui",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Skip persisting transient flags. Keep only the long-lived prefs.
      partialize: (s) => ({
        theme: s.theme,
        locale: s.locale,
        lightweightMode: s.lightweightMode,
        sidebarCollapsed: s.sidebarCollapsed,
        tipsSeen: s.tipsSeen,
      }),
    },
  ),
);
