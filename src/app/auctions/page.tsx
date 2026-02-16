import { getAuctions } from '@/actions/auction';
import AuctionCard from '@/components/auction/AuctionCard';
import Link from 'next/link';
import { Search, SlidersHorizontal, MapPin } from 'lucide-react';
import { CATEGORIES, LOCATIONS } from '@/types';
import type { AuctionStatus } from '@/types';

interface Props {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
    status?: string;
    location?: string;
  }>;
}

export default async function AuctionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const { auctions, total, pages } = await getAuctions({
    category: params.category,
    search: params.search,
    sortBy: (params.sortBy as 'endTime' | 'currentPrice' | 'createdAt' | 'bids') || 'endTime',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'asc',
    page,
    status: (params.status as any) || 'ACTIVE',
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
              ? CATEGORIES.find(c => c.slug === params.category)?.label || 'Auctions'
              : params.search
                ? `Results for "${params.search}"`
                : 'Live Auctions'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} auction{total !== 1 ? 's' : ''} found</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-56 flex-shrink-0">
          {/* Search */}
          <form className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={params.search}
                placeholder="Search auctions..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </form>

          {/* Categories */}
          <div className="mb-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Categories
            </h3>
            <div className="space-y-1">
              <Link
                href="/auctions"
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  !params.category ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                All Categories
              </Link>
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/auctions?category=${cat.slug}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    params.category === cat.slug ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.icon} {cat.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3">Sort By</h3>
            <div className="space-y-1">
              {[
                { value: 'endTime', label: 'Ending Soon' },
                { value: 'currentPrice', label: 'Price' },
                { value: 'createdAt', label: 'Newest' },
                { value: 'bids', label: 'Most Bids' },
              ].map((sort) => (
                <Link
                  key={sort.value}
                  href={`/auctions?${new URLSearchParams({
                    ...(params.category ? { category: params.category } : {}),
                    ...(params.search ? { search: params.search } : {}),
                    sortBy: sort.value,
                  }).toString()}`}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    params.sortBy === sort.value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {sort.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mt-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location
            </h3>
            <div className="space-y-1">
              <Link
                href={`/auctions?${new URLSearchParams({
                  ...(params.category ? { category: params.category } : {}),
                  ...(params.search ? { search: params.search } : {}),
                  ...(params.sortBy ? { sortBy: params.sortBy } : {}),
                }).toString()}`}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  !params.location ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                All Bangladesh
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
                    params.location === loc.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {loc.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Auction Grid */}
        <div className="flex-1">
          {auctions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">🔍</p>
              <h3 className="font-heading font-semibold text-gray-900 mb-1">No auctions found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
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
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
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
