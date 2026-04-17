"use client";

import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationsProvider } from "@/context/NotificationsContext";

import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <NotificationsProvider>
          {children}
          <Toaster position="bottom-center" />
        </NotificationsProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
