"use client";

import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationProvider } from "./NotificationProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <SettingsProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
