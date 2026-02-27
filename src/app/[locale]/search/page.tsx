import { prisma } from "@/lib/db";
import AuctionCard from "@/components/auction/AuctionCard";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import type { AuctionWithSeller } from "@/types";
import LoadMore from "@/components/auction/LoadMore";

export default async function SearchPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { q, category, sort } = await searchParams;

  const query = q || "";
  const catFilter = category || "All";
  const sortBy = sort || "ending_soon";

  // Build Prisma where clause (Keyword fallback)
  const whereClause: Record<string, unknown> = {
    status: "ACTIVE",
  };

  if (catFilter !== "All") {
    whereClause.category = catFilter;
  }

  let auctions: (AuctionWithSeller & { semanticScore?: number })[] = [];

  if (query) {
    // Enterprise Strategy: Use Semantic Ranking for queries
    const { getSmartSearchResults } = await import("@/actions/search");
    auctions = await getSmartSearchResults(
      query,
      catFilter !== "All" ? catFilter : undefined,
    );
  } else {
    // Build Prisma orderBy clause for general browsing
    let orderByClause: Record<string, unknown> = { endTime: "asc" }; // ending soon default
    if (sortBy === "price_asc") {
      orderByClause = { currentPrice: "asc" };
    } else if (sortBy === "price_desc") {
      orderByClause = { currentPrice: "desc" };
    }

    auctions = await prisma.auction.findMany({
      where: whereClause,
      orderBy: orderByClause,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isVerifiedSeller: true,
            reputationScore: true,
            isPhoneVerified: true,
          },
        },
        _count: { select: { bids: true } },
      },
      take: 24, // Initial load for performance
    });
  }

  const categories = [
    "All",
    "Electronics",
    "Vehicles",
    "Property",
    "Jewelry",
    "Art",
    "Antiques",
    "Other",
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
              {query ? `Search Results for "${query}"` : "Browse Auctions"}
            </h1>
            <p className="text-gray-500">
              Found {auctions.length} active{" "}
              {auctions.length === 1 ? "auction" : "auctions"}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4 pb-4 border-b border-gray-100">
                <SlidersHorizontal className="w-5 h-5 text-primary-600" />
                Filters
              </div>

              {/* Category Filter */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Category
                </h3>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <a
                      key={cat}
                      href={`/${locale}/search?q=${query}&category=${cat}&sort=${sortBy}`}
                      className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                        catFilter === cat
                          ? "bg-primary-50 text-primary-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {cat}
                    </a>
                  ))}
                </div>
              </div>

              {/* Sort Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" /> Sort By
                </h3>
                <div className="space-y-2">
                  <a
                    href={`/${locale}/search?q=${query}&category=${catFilter}&sort=ending_soon`}
                    className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                      sortBy === "ending_soon"
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Ending Soon
                  </a>
                  <a
                    href={`/${locale}/search?q=${query}&category=${catFilter}&sort=price_asc`}
                    className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                      sortBy === "price_asc"
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Lowest Price
                  </a>
                  <a
                    href={`/${locale}/search?q=${query}&category=${catFilter}&sort=price_desc`}
                    className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
                      sortBy === "price_desc"
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Highest Price
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="flex-1">
            {auctions.length > 0 ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {auctions.map((auction) => (
                    <AuctionCard
                      key={auction.id}
                      auction={auction as unknown as AuctionWithSeller}
                    />
                  ))}
                </div>

                {/* Lazy Loading (Enterprise Scale) */}
                {!query && (
                  <LoadMore
                    initialPage={1}
                    filters={{ category: catFilter, sortBy: sortBy as any }}
                  />
                )}
              </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                <Search className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-xl font-heading font-semibold text-gray-900 mb-2">
                  No results found
                </h3>
                <p className="text-gray-500 max-w-sm mb-6">
                  We couldn&apos;t find any auctions matching your criteria. Try
                  adjusting your filters or search term.
                </p>
                <a
                  href={`/${locale}/search`}
                  className="px-6 py-2.5 bg-primary-50 text-primary-700 font-medium rounded-xl hover:bg-primary-100 transition-colors"
                >
                  Clear all filters
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
