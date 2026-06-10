"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { LOCATIONS } from "@/types";
import { useTranslations } from "next-intl";

/**
 * `locale` prop is retained for backwards compatibility with the page that
 * passes it, but the URLs no longer prefix with it (the [locale] folder was
 * removed; routing is flat).
 */
export function AreaQuickLinks({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations("Home");
  const tLoc = useTranslations("Locations");

  // Top 6 locations for the quick grid
  const quickLocs = LOCATIONS.slice(0, 6);

  return (
    <section className="py-12 border-t border-gray-100" aria-labelledby="area-quick-links-heading">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 id="area-quick-links-heading" className="text-2xl font-heading font-bold text-gray-900">
            {t("browseByArea")}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t("browseByAreaDesc")}
          </p>
        </div>
        <Link
          href="/auctions"
          className="text-primary-600 font-semibold text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        >
          {t("viewAllLocations")}
        </Link>
      </div>

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 list-none p-0">
        {quickLocs.map((loc) => {
          const label = tLoc(loc.id);
          return (
            <li key={loc.id}>
              <Link
                href={`/auctions?location=${loc.id}`}
                aria-label={`Browse auctions in ${label}, Dhaka`}
                className="group p-6 bg-white rounded-md border border-gray-100 hover:border-primary-100 hover:bg-primary-50/30 transition-all duration-300 text-center flex flex-col items-center gap-3 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors" aria-hidden="true">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                  {label}
                </span>
                <span className="text-[11px] text-gray-400 uppercase tracking-wide font-bold">
                  {t("dhaka")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
