import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default withNextIntl(nextConfig);
