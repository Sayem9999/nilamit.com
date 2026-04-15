/**
 * Root Layout — Nilamit App
 *
 * With next-intl, the actual <html>/<body> tags live inside
 * src/app/[locale]/layout.tsx so that `lang` can be set per locale.
 * This root layout is intentionally a thin passthrough shell.
 *
 * What it DOES do:
 *   1. Validates environment variables at server startup (fail-fast)
 *   2. Provides fallback metadata (overridden by locale layout)
 */

import type { Metadata } from "next";
import { validateEnv } from "@/lib/env";

// ─── Startup validation ──────────────────────────────────────
// Runs once when the module is first imported (server start / build).
// Missing required env vars throw immediately — no silent failures.
if (typeof window === "undefined") {
  validateEnv();
}

// ─── Fallback metadata (locale layout overrides these) ──────
export const metadata: Metadata = {
  title: {
    default: "Nilamit — Bangladesh's Trusted Auction Marketplace",
    template: "%s | Nilamit",
  },
  description:
    "Buy & sell through transparent, real-time bidding. Bangladesh's first dedicated C2C auction marketplace.",
  keywords: ["auction", "bidding", "bangladesh", "c2c", "marketplace", "nilamit"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://nilamit.app",
    siteName: "Nilamit",
    title: "Nilamit — Bangladesh's Trusted Auction Marketplace",
    description: "Buy & sell through transparent, real-time bidding.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nilamit — Bangladesh's Trusted Auction Marketplace",
    description: "Buy & sell through transparent, real-time bidding.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // <html> and <body> are provided by [locale]/layout.tsx
  // so the `lang` attribute matches the active locale.
  return children;
}
