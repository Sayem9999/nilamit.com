import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { validateEnv } from "./src/lib/env";

// 🛡️ Validate environment variables on startup/build
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  // Output standalone bundle — required for Cloud Run / Docker deployments
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "*.uploadthing.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },

  logging: {
    fetches: { fullUrl: false },
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },

  async headers() {
    // Content-Security-Policy.
    //
    // Why 'unsafe-inline' on script-src: Next.js App Router emits inline
    // hydration/streaming scripts; without explicit nonces (which would
    // require middleware-injected per-request values) those would be blocked.
    // Style 'unsafe-inline' is needed for Tailwind/shadcn runtime classes.
    //
    // Allowed third parties — keep this list tight; every entry is an
    // attacker pivot if a bug lands on the site.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.sentry-cdn.com https://browser.sentry-cdn.com https://*.pusher.com https://*.firebaseio.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://utfs.io https://*.uploadthing.com https://*.uploadthing.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://avatars.githubusercontent.com https://*.ingest.sentry.io",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.cloudfunctions.net https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com https://*.ingest.sentry.io https://*.sentry.io https://utfs.io https://*.uploadthing.com",
      "frame-src 'self' https://*.firebaseapp.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy",   value: csp },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-XSS-Protection",          value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

// Sync export — required for Firebase App Hosting build pipeline
export default withNextIntl(nextConfig);
