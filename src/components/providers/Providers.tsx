"use client";

import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/context/SettingsContext";
import { NotificationProvider } from "./NotificationProvider";
import { QueryProvider } from "./QueryProvider";
import { WebVitalsReporter } from "@/components/rum/WebVitalsReporter";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <QueryProvider>
        <SettingsProvider>
          <NotificationProvider>
            {/* Offline banner — fixed across top whenever navigator.onLine is false. */}
            <OfflineIndicator />
            {children}
            {/* RUM (web-vitals → /api/rum → BigQuery). Renders null. */}
            <WebVitalsReporter />
            {/* PWA install prompt — bottom-right toast after 15s of dwell. */}
            <InstallPrompt />
          </NotificationProvider>
        </SettingsProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
