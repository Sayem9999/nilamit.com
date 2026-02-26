"use client";

import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationProvider } from "./NotificationProvider";

import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SettingsProvider>
        <NotificationProvider>
          {children}
          <Toaster position="bottom-center" />
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
