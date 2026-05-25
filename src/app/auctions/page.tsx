import { getAuctions } from "@/actions/auction";
export const dynamic = "force-dynamic";

import AuctionCard from "@/components/auction/AuctionCard";
import LoadMore from "@/components/auction/LoadMore";
import Link from "next/link";
import { Search as SearchIcon, SlidersHorizontal, MapPin, LayoutGrid, Rows3 } from "lucide-react";
import { CATEGORIES, LOCATIONS, AuctionWithSeller, AuctionStatus } from "@/types";
import { getTranslations } from "next-intl/server";

interface AuctionsSearchParams {
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  location?: string;
  view?: string;
}

interface Props {
  searchParams: Promise<AuctionsSearchParams>;
}

/**
 * Build a query string from a base param set + overrides. Used to construct
 * filter links that preserve other active filters (e.g. clicking a location
 * keeps the current category selection).
 */
function buildQs(base: AuctionsSearchParams, overrides: Partial<AuctionsSearchParams>): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...base, ...overrides })) {
    if (v !== undefined && v !== null && v !== "") merged[k] = String(v);
  }
  const qs = new URLSearchParams(merged).toString();
  return qs ? `/auctions?${qs}` : "/auctions";
}

export default async function AuctionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const t    = await getTranslations("Search");
  const tCat = await getTranslations("Categories");
  const tLoc = await getTranslations("Locations");

  const viewMode = (params.view as "grid" | "list") || "grid";

  const filters = {
    category: params.category,
    search:   params.search,
    sortBy:   (params.sortBy as "endTime" | "currentPrice" | "createdAt" | "bids") || "endTime",
    sortOrder:(params.sortOrder as "asc" | "desc") || "asc",
    status:   (params.status as AuctionStatus) || "ACTIVE",
    location: params.location,
    limit:    12,
  };

  const response = await getAuctions(filters);
  const { auctions: initialAuctions, total, lastId } = (response.success && response.data)
    ? response.data
    : { auctions: [] as AuctionWithSeller[], total: 0, lastId: null as string | null };

  const hasActiveFilter = !!(params.category || params.location || params.search);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-gray-900 tracking-tight">
            {params.category
              ? tCat(params.category)
              : params.search
                ? t("resultsFor", { query: params.search })
                : t("title")}
          </h1>
          <div className="flex items-center gap-4 mt-1.5">
            <p className="text-sm text-gray-500 font-semibold">
              {t("found", { count: total })}
            </p>
            {/* eBay Grid/List Toggle Switcher */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 border border-gray-200/50">
              <Link
                href={buildQs(params, { view: "grid" })}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "grid" ? "bg-white dark:bg-slate-900 text-primary-600 shadow-xs" : "text-gray-400 hover:text-gray-600"
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={buildQs(params, { view: "list" })}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "list" ? "bg-white dark:bg-slate-900 text-primary-600 shadow-xs" : "text-gray-400 hover:text-gray-600"
                }`}
                aria-label="List view"
              >
                <Rows3 className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
        {hasActiveFilter && (
          <Link
            href="/auctions"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-primary-600 transition-colors uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            {t("clearFilters")}
          </Link>
        )}
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-56 flex-shrink-0" aria-label={t("filters")}>
          {/* Search */}
          <form className="mb-6" role="search" action="/auctions">
            <label htmlFor="auctions-search" className="sr-only">{t("searchPlaceholder")}</label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <input
                id="auctions-search"
                type="search"
                name="search"
                defaultValue={params.search}
                placeholder={t("searchPlaceholder")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </form>

          {/* Categories */}
          <nav className="mb-6" aria-labelledby="filter-category-heading">
            <h2 id="filter-category-heading" className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> {t("category")}
            </h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildQs(params, { category: undefined })}
                  aria-current={!params.category ? "page" : undefined}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    !params.category
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t("allCategories")}
                </Link>
              </li>
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={buildQs(params, { category: cat.slug })}
                    aria-current={params.category === cat.slug ? "page" : undefined}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      params.category === cat.slug
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tCat(cat.slug)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Location */}
          <nav aria-labelledby="filter-location-heading">
            <h2 id="filter-location-heading" className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" aria-hidden="true" /> {t("location")}
            </h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildQs(params, { location: undefined })}
                  aria-current={!params.location ? "page" : undefined}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    !params.location
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t("allAreas")}
                </Link>
              </li>
              {LOCATIONS.map((loc) => (
                <li key={loc.id}>
                  <Link
                    href={buildQs(params, { location: loc.id })}
                    aria-current={params.location === loc.id ? "page" : undefined}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      params.location === loc.id
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {tLoc(loc.id)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Results Grid */}
        <section className="flex-1" aria-label="Auction results">
          {initialAuctions.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-900">
                {t("noResults")}
              </h2>
              <p className="text-gray-500 max-w-xs mx-auto mt-2">
                {t("noResultsDesc")}
              </p>
              {hasActiveFilter && (
                <Link
                  href="/auctions"
                  className="inline-block mt-4 text-sm font-bold text-primary-600 hover:text-primary-700"
                >
                  {t("clearFilters")}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className={viewMode === "list" ? "flex flex-col gap-4" : "grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6"}>
                {initialAuctions.map((auction) => (
                  <AuctionCard key={auction.id} auction={auction} viewMode={viewMode} />
                ))}
              </div>

              <LoadMore key={JSON.stringify(filters)} filters={filters} initialLastId={lastId} viewMode={viewMode} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
