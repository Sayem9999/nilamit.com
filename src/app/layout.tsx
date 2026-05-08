import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { env, validateEnv } from "@/lib/env";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "react-hot-toast";
import Script from "next/script";

// ─── Startup validation ──────────────────────────────────────
if (typeof window === "undefined") {
  validateEnv();
}

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const DOMAIN = "https://nilamit.com";

function getMetadataBase() {
  const urlString = env.NEXT_PUBLIC_APP_URL || DOMAIN;
  try {
    return new URL(urlString);
  } catch {
    return new URL(DOMAIN);
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = "en";
  const t = await getTranslations({ locale, namespace: "Meta" });
  const metadataBase = getMetadataBase();
  const canonicalUrl = metadataBase.toString();
  
  return {
    metadataBase,
    title: {
      default: t("title") || "Nilamit — Bangladesh's Trusted Auction Marketplace",
      template: "%s | Nilamit",
    },
    description: t("description") || "Buy & sell through transparent, real-time bidding.",
    keywords: t("keywords")?.split(",") || ["auction", "bidding", "bangladesh"],
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Nilamit",
    },
    icons: {
      icon: "/icon-512.png",
      apple: "/icon-512.png",
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: canonicalUrl,
      siteName: "Nilamit",
      title: t("title"),
      description: t("description"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "OjIKaSD-ma3NBt0SaALVbjPUuaPGkHzpyNdhbFQ2qrE",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = "en";
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased bg-white text-gray-900 font-body`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 500,
                },
              }}
            />
            <Navbar />
            <main className="min-h-screen bg-gray-50/50">{children}</main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
        <Script src="/sw-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
