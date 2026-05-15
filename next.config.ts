import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { validateEnv } from "./src/lib/env";
import { withSentryConfig } from "@sentry/nextjs";

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
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
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
  serverExternalPackages: ["@google-cloud/tasks"],

  async headers() {
    const csp = [
      "default-src 'self' https://*.nilamit.com https://nilamit.com https://*.hosted.app https://*.firebaseapp.com https://*.web.app",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.nilamit.com https://nilamit.com https://*.hosted.app https://js.sentry-cdn.com https://browser.sentry-cdn.com https://*.pusher.com https://*.firebaseio.com https://*.firebasedatabase.app https://www.gstatic.com https://*.googleapis.com https://www.google.com https://*.recaptcha.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.nilamit.com https://nilamit.com https://*.hosted.app",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://utfs.io https://*.uploadthing.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://avatars.githubusercontent.com https://i.pravatar.cc https://images.unsplash.com https://*.ingest.sentry.io https://*.nilamit.com https://nilamit.com https://*.hosted.app",
      "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
      "connect-src 'self' https://*.googleapis.com https://storage.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.cloudfunctions.net https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.sentry.io https://utfs.io https://*.uploadthing.com https://*.nilamit.com https://nilamit.com https://*.hosted.app https://*.firebaseapp.com https://www.google.com https://*.recaptcha.net",
      "frame-src 'self' https://*.firebaseapp.com https://*.firebaseio.com https://*.firebasedatabase.app https://*.nilamit.com https://nilamit.com https://*.hosted.app https://www.google.com https://*.recaptcha.net",
      "media-src 'self' https://*.nilamit.com https://nilamit.com https://*.hosted.app",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.nilamit.com https://nilamit.com https://*.hosted.app https://*.firebaseapp.com",
      "frame-ancestors 'none'",
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
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
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

  async rewrites() {
    return [
      {
        source: '/__/auth/action',
        destination: '/auth/action',
      },
      {
        source: '/__/auth/:path*',
        destination: 'https://nilamit-52073.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

// Wrap with Sentry and Intl
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
