"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/context/LanguageContext";
import { SettingsProvider } from "@/context/SettingsContext";

import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <LanguageProvider>
          {children}
          <Toaster position="bottom-center" />
        </LanguageProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
