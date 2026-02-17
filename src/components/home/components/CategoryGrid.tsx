"use client";

import Link from "next/link";
import { CATEGORIES } from "@/types";

import { TranslationType } from "@/types/home";

interface CategoryGridProps {
  t: TranslationType;
}

export function CategoryGrid({ t }: CategoryGridProps) {
  return (
    <section className="py-16 sm:py-20 bg-gray-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
            {t.home.categories_title}
          </h2>
          <p className="mt-2 text-gray-500">{t.home.categories_subtitle}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {CATEGORIES.filter((c) => c.slug !== "other").map((cat) => (
            <Link
              key={cat.slug}
              href={`/auctions?category=${cat.slug}`}
              className="bg-white hover:bg-primary-50 border border-gray-100 hover:border-primary-200 rounded-2xl p-5 text-center transition-all group shadow-sm hover:shadow-md"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {cat.icon}
              </div>
              <p className="text-sm font-bold text-gray-700 group-hover:text-primary-700">
                {cat.label}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
