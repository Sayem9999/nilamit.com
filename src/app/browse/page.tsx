import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Sparkles } from "lucide-react";
import { CATEGORIES } from "@/types/common";
import { InstallAppButton } from "@/components/install/InstallAppButton";

export const metadata: Metadata = {
  title: "Browse all categories — Nilamit",
  description:
    "Explore every category on Nilamit — mobile phones, electronics, vehicles, fashion, and more. Bid live on verified auctions across Bangladesh.",
  alternates: { canonical: "/browse" },
};

export default function BrowsePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2 text-primary-600 text-xs font-bold uppercase tracking-wider">
          <LayoutGrid className="w-4 h-4" aria-hidden="true" /> Browse
        </div>
        <h1 className="mt-1 font-heading font-bold text-2xl sm:text-3xl text-gray-900">
          All categories
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick a category to see live auctions, or{" "}
          <Link href="/auctions" className="text-primary-600 font-semibold hover:underline">
            view everything
          </Link>
          .
        </p>
      </header>

      {/* Category grid — responsive, touch-friendly tap targets */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/auctions?category=${c.slug}`}
            aria-label={`Browse ${c.label}`}
            className="group flex flex-col items-center justify-center gap-2 rounded-md border border-gray-200 bg-white p-4 sm:p-6 text-center shadow-sm hover:border-primary-400 hover:shadow-md transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <span className="text-3xl sm:text-4xl leading-none transition-transform group-hover:scale-110" aria-hidden="true">
              {c.icon}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-primary-700 leading-tight">
              {c.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Get-the-app CTA */}
      <section className="mt-12 rounded-md border border-primary-100 bg-gradient-to-br from-primary-50/60 to-white p-6 sm:p-8 text-center">
        <div className="inline-flex items-center gap-1.5 text-primary-600 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" aria-hidden="true" /> Nilamit on your phone
        </div>
        <h2 className="mt-2 font-heading font-bold text-xl sm:text-2xl text-gray-900">
          Get the Nilamit app
        </h2>
        <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
          Install for one-tap bidding, instant outbid alerts, and a full-screen
          app experience on Android, iOS, and desktop.
        </p>
        <div className="mt-5">
          <InstallAppButton />
        </div>
      </section>

      {/* Footer link */}
      <div className="mt-8 text-center">
        <Link
          href="/auctions"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:gap-2.5 transition-all"
        >
          Browse all auctions <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
