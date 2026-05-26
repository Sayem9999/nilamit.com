import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono, Noto_Sans_Bengali } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MerchantSubNav } from "@/components/layout/MerchantSubNav";
import { env, validateEnv } from "@/lib/env";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { headers } from "next/headers";

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

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
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
      icon: [
        { url: "/icon.png", sizes: "48x48", type: "image/png" },
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: [
        { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      ],
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
  const nonce = (await headers()).get('x-nonce') || undefined;

  const metadataBase = getMetadataBase();
  const baseUrl = metadataBase.toString().replace(/\/$/, "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        "url": `${baseUrl}/`,
        "name": "Nilamit",
        "alternateName": ["nilamit", "nilamit.com", "নিলামিত", "নীলামিত"],
        "description": "Bangladesh's Trusted C2C Auction Marketplace",
        "publisher": {
          "@id": `${baseUrl}/#organization`
        }
      },
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": "Nilamit",
        "url": `${baseUrl}/`,
        "logo": {
          "@type": "ImageObject",
          "@id": `${baseUrl}/#logo`,
          "url": `${baseUrl}/icon-512.png`,
          "caption": "Nilamit"
        },
        "image": {
          "@id": `${baseUrl}/#logo`
        }
      }
    ]
  };

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body
        className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} ${notoBengali.variable} antialiased bg-white text-gray-900 font-body`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <script
            type="application/ld+json"
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
            }}
          />
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
            <MerchantSubNav />
            <main className="min-h-screen bg-gray-50/50">{children}</main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
        <Script src="/sw-register.js" strategy="afterInteractive" nonce={nonce} />
      </body>
    </html>
  );
}
