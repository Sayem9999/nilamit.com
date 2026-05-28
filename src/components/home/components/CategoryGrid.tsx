"use client";

import Link from "next/link";
import { CATEGORIES } from "@/types";
import { useTranslations } from "next-intl";

export function CategoryGrid() {
  const t = useTranslations("Home");
  const tCat = useTranslations("Categories");

  return (
    <section
      aria-labelledby="home-categories-heading"
      className="py-8 sm:py-10 bg-white"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-baseline justify-between mb-4 sm:mb-6">
          <h2
            id="home-categories-heading"
            className="font-heading font-bold text-xl sm:text-2xl text-gray-900 tracking-tight"
          >
            {t("categoriesTitle")}
          </h2>
          <Link
            href="/auctions"
            className="text-sm font-bold text-primary-600 hover:underline"
          >
            {t("seeAll")}
          </Link>
        </div>

        <ul className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-2 sm:gap-3">
          {CATEGORIES.filter((c) => c.slug !== "other").map((cat) => (
            <li key={cat.slug}>
              <Link
                href={`/auctions?category=${cat.slug}`}
                aria-label={`Browse ${tCat(cat.slug)} auctions`}
                className="group flex flex-col items-center bg-white border border-gray-200 hover:border-primary-400 hover:shadow-sm rounded-md p-3 sm:p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <div className="text-2xl sm:text-3xl mb-1.5 group-hover:scale-110 transition-transform" aria-hidden="true">
                  {cat.icon}
                </div>
                <p className="text-[11px] sm:text-xs font-semibold text-gray-700 group-hover:text-primary-700 text-center leading-tight">
                  {tCat(cat.slug)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
