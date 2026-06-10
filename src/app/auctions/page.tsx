import { getAuctions } from "@/actions/auction";
export const dynamic = "force-dynamic";

import AuctionCard from "@/components/auction/AuctionCard";
import LoadMore from "@/components/auction/LoadMore";
import SortSelector from "@/components/auction/SortSelector";
import Link from "next/link";
import { Search as SearchIcon, SlidersHorizontal, MapPin, LayoutGrid, Rows3 } from "lucide-react";
import { SaveSearchButton } from "@/components/auction/SaveSearchButton";
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
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 pb-4 border-b border-gray-200">
        <div>
          <h1 className="font-heading font-bold text-xl sm:text-2xl text-gray-900 tracking-tight">
            {params.category
              ? tCat(params.category)
              : params.search
                ? t("resultsFor", { query: params.search })
                : t("title")}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <p className="text-sm text-gray-500">
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
            {/* eBay-Style Sorting Selector */}
            <SortSelector
              currentSortBy={filters.sortBy}
              currentSortOrder={filters.sortOrder}
              baseParams={params as unknown as Record<string, string>}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilter && (
            <>
              <SaveSearchButton
                filters={{
                  search: params.search,
                  category: params.category,
                  location: params.location,
                }}
              />
              <Link
                href="/auctions"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-primary-600 transition-colors uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                {t("clearFilters")}
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Filters */}
        <aside className="lg:w-52 flex-shrink-0" aria-label={t("filters")}>
          {/* Search */}
          <form className="mb-5" role="search" action="/auctions">
            <label htmlFor="auctions-search" className="sr-only">{t("searchPlaceholder")}</label>
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <input
                id="auctions-search"
                type="search"
                name="search"
                defaultValue={params.search}
                placeholder={t("searchPlaceholder")}
                className="w-full bg-white border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
              />
            </div>
          </form>

          {/* Categories */}
          <nav className="mb-5 pb-5 border-b border-gray-200" aria-labelledby="filter-category-heading">
            <h2 id="filter-category-heading" className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" aria-hidden="true" /> {t("category")}
            </h2>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={buildQs(params, { category: undefined })}
                  aria-current={!params.category ? "page" : undefined}
                  className={`block px-2 py-1.5 rounded text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    !params.category
                      ? "bg-primary-50 text-primary-700 font-semibold"
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
                    className={`block px-2 py-1.5 rounded text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      params.category === cat.slug
                        ? "bg-primary-50 text-primary-700 font-semibold"
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
            <h2 id="filter-location-heading" className="font-bold text-[11px] uppercase tracking-wide text-gray-500 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" aria-hidden="true" /> {t("location")}
            </h2>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={buildQs(params, { location: undefined })}
                  aria-current={!params.location ? "page" : undefined}
                  className={`block px-2 py-1.5 rounded text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    !params.location
                      ? "bg-primary-50 text-primary-700 font-semibold"
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
                    className={`block px-2 py-1.5 rounded text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      params.location === loc.id
                        ? "bg-primary-50 text-primary-700 font-semibold"
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
            <div className="text-center py-20 bg-gray-50 rounded-md border border-dashed border-gray-200">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
              {/* Two distinct zero states: a filtered search with no hits gets
                  "adjust your filters"; an EMPTY MARKETPLACE (no filters, no
                  inventory) gets a supply-side CTA — telling a visitor to
                  adjust filters when nothing is listed is a dead end. */}
              <h2 className="text-lg font-semibold text-gray-900">
                {hasActiveFilter ? t("noResults") : t("emptyMarketTitle")}
              </h2>
              <p className="text-gray-500 max-w-xs mx-auto mt-2">
                {hasActiveFilter ? t("noResultsDesc") : t("emptyMarketDesc")}
              </p>
              {hasActiveFilter ? (
                <Link
                  href="/auctions"
                  className="inline-block mt-4 text-sm font-bold text-primary-600 hover:text-primary-700"
                >
                  {t("clearFilters")}
                </Link>
              ) : (
                <Link
                  href="/auctions/create"
                  className="inline-block mt-5 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-md transition-colors"
                >
                  {t("emptyMarketCta")}
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
