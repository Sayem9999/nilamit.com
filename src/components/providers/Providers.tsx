"use client";

import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationProvider } from "./NotificationProvider";
import { QueryProvider } from "./QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <QueryProvider>
        <SettingsProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </SettingsProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
