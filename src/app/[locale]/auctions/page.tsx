import { getAuctions } from "@/actions/auction";
export const dynamic = "force-dynamic";

import AuctionCard from "@/components/auction/AuctionCard";
import Link from "next/link";
import { Search as SearchIcon, SlidersHorizontal, MapPin } from "lucide-react";
import { CATEGORIES, LOCATIONS } from "@/types";
import type { AuctionStatus } from "@/types";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
    status?: string;
    location?: string;
    locale?: string;
  }>;
}

export default async function AuctionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const t = await getTranslations("Search");
  const tCat = await getTranslations("Categories");
  const tLoc = await getTranslations("Locations");

  const { auctions, total, pages } = await getAuctions({
    category: params.category,
    search: params.search,
    sortBy:
      (params.sortBy as "endTime" | "currentPrice" | "createdAt" | "bids") ||
      "endTime",
    sortOrder: (params.sortOrder as "asc" | "desc") || "asc",
    page,
    status: (params.status as AuctionStatus) || "ACTIVE",
    location: params.location,
    limit: 12,
  });

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
                href="/auctions"
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
                  href={`/auctions?category=${cat.slug}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    params.category === cat.slug
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat.icon} {tCat(cat.slug)}
                </Link>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3">
              {t("sortBy")}
            </h3>
            <div className="space-y-1">
              {[
                { value: "endTime", label: t("endingSoon") },
                { value: "currentPrice", label: t("lowestPrice") },
                { value: "createdAt", label: t("newest") },
                { value: "bids", label: t("mostBids") },
              ].map((sortOption) => (
                <Link
                  key={sortOption.value}
                  href={`/auctions?${new URLSearchParams({
                    ...(params.category ? { category: params.category } : {}),
                    ...(params.search ? { search: params.search } : {}),
                    sortBy: sortOption.value,
                  }).toString()}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    params.sortBy === sortOption.value
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {sortOption.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mt-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> {t("location")}
            </h3>
            <div className="space-y-1">
              <Link
                href={`/auctions?${new URLSearchParams({
                  ...(params.category ? { category: params.category } : {}),
                  ...(params.search ? { search: params.search } : {}),
                  ...(params.sortBy ? { sortBy: params.sortBy } : {}),
                }).toString()}`}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  !params.location
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t("allBangladesh")}
              </Link>
              {LOCATIONS.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/auctions?${new URLSearchParams({
                    ...(params.category ? { category: params.category } : {}),
                    ...(params.search ? { search: params.search } : {}),
                    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
                    location: loc.id,
                  }).toString()}`}
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

        {/* Auction Grid */}
        <div className="flex-1">
          {auctions.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
              <SearchIcon className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="font-heading font-semibold text-gray-900 mb-1">
                {t("noResults")}
              </h3>
              <p className="text-sm text-gray-500">
                {t("noResultsDesc")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction as any} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/auctions?${new URLSearchParams({
                    ...(params.category ? { category: params.category } : {}),
                    ...(params.search ? { search: params.search } : {}),
                    ...(params.sortBy ? { sortBy: params.sortBy } : {}),
                    page: p.toString(),
                  }).toString()}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-primary-600 text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
