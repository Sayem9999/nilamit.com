"use client";

import Link from "next/link";
import { CATEGORIES } from "@/types";
import { motion } from "framer-motion";

import { useTranslations, useLocale } from "next-intl";

export function CategoryGrid() {
  const t = useTranslations("Home");
  const tCat = useTranslations("Categories");
  const locale = useLocale();

  return (
    <section className="py-16 sm:py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading font-black text-4xl sm:text-5xl text-gray-900 tracking-tight mb-4">
            {t("categoriesTitle")}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-medium">
            {t("categoriesSubtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1 sm:gap-6">
          {CATEGORIES.filter((c) => c.slug !== "other").map((cat) => (
            <Link
              key={cat.slug}
              href={`/auctions?category=${cat.slug}`}
              className="group flex flex-col items-center bg-gray-50/50 hover:bg-white p-6 rounded-3xl transition-all border border-transparent hover:border-primary-100 hover:shadow-xl hover:shadow-primary-600/5"
            >
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform mb-4">
                {cat.icon}
              </div>
              <p className="text-sm font-bold text-gray-700 group-hover:text-primary-700">
                {tCat(cat.slug)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
