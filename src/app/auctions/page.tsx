import { getAuctions } from "@/actions/auction";
export const dynamic = "force-dynamic";

import AuctionCard from "@/components/auction/AuctionCard";
import LoadMore from "@/components/auction/LoadMore";
import Link from "next/link";
import { Search as SearchIcon, SlidersHorizontal, MapPin } from "lucide-react";
import { CATEGORIES, LOCATIONS, AuctionWithSeller, AuctionStatus } from "@/types";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    status?: string;
    location?: string;
    locale?: string;
  }>;
}

export default async function AuctionsPage({ params: routeParams, searchParams }: { params: Promise<{ locale: string }>, searchParams: Props['searchParams'] }) {
  const { locale } = await routeParams;
  const params = await searchParams;
  const t = await getTranslations("Search");
  const tCat = await getTranslations("Categories");
  const tLoc = await getTranslations("Locations");
  
  const filters = {
    category: params.category,
    search: params.search,
    sortBy:
      (params.sortBy as "endTime" | "currentPrice" | "createdAt" | "bids") ||
      "endTime",
    sortOrder: (params.sortOrder as "asc" | "desc") || "asc",
    status: (params.status as AuctionStatus) || "ACTIVE",
    location: params.location,
    limit: 12,
  };

  const response = await getAuctions(filters);

  const { auctions: initialAuctions, total } = (response.success && response.data)
    ? response.data 
    : { auctions: [] as AuctionWithSeller[], total: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
            {params.category
              ? tCat(params.category)
              : params.search
                ? t("resultsFor", { query: params.search })
                : t("title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("found", { count: total })}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-56 flex-shrink-0">
          {/* Search */}
          <form className="mb-6">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={params.search}
                placeholder={t("searchPlaceholder") || "Search auctions..."}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </form>

          {/* Categories */}
          <div className="mb-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> {t("category")}
            </h3>
            <div className="space-y-1">
              <Link
                href={`/${locale}/auctions`}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  !params.category
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t("allCategories")}
              </Link>
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/${locale}/auctions?category=${cat.slug}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    params.category === cat.slug
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tCat(cat.slug)}
                </Link>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mb-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> {t("location")}
            </h3>
            <div className="space-y-1">
              <Link
                href={`/${locale}/auctions`}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  !params.location
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t("allLocations")}
              </Link>
              {LOCATIONS.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/${locale}/auctions?location=${loc.id}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    params.location === loc.id
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tLoc(loc.id)}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Results Grid */}
        <div className="flex-1">
          {initialAuctions.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t("noResults")}
              </h3>
              <p className="text-gray-500 max-w-xs mx-auto mt-2">
                {t("noResultsDesc")}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {initialAuctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>

              <LoadMore filters={filters} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
