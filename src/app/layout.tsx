import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { SettingsProvider } from "@/context/SettingsContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "nilamit.com — Bangladesh's Trusted Auction Marketplace",
  description: "Buy and sell through transparent auctions. Verified sellers, anti-sniping protection, and real-time bidding. Bangladesh's #1 C2C auction platform.",
  keywords: ["nilam", "auction", "bangladesh", "bidding", "marketplace", "নিলাম"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log('[Layout] Rendering RootLayout');
  return (
    <html lang="en">
      <body
        className={`${plusJakarta.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased bg-white text-gray-900 font-body`}
      >
        <SessionProvider>
          <SettingsProvider>
            <LanguageProvider>
              <Navbar />
              <main className="min-h-screen bg-gray-50/50">
                {children}
              </main>
              <Footer />
            </LanguageProvider>
          </SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
