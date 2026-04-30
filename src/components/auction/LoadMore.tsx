"use client";

import { useState } from "react";
import { getAuctions } from "@/actions/auction";
import type { AuctionWithSeller, AuctionFilters } from "@/types";
import AuctionCard from "./AuctionCard";
import { Loader2 } from "lucide-react";

interface LoadMoreProps {
  initialPage: number;
  filters: AuctionFilters;
  locale: string;
}

export default function LoadMore({
  filters,
}: Omit<LoadMoreProps, "locale" | "initialPage">) {
  const [auctions, setAuctions] = useState<AuctionWithSeller[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadNextPage = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const response = await getAuctions({ ...filters, lastId: lastId || undefined, limit: 12 });
      if (response.success && response.data && response.data.auctions.length > 0) {
        setAuctions((prev) => [
          ...prev,
          ...(response.data!.auctions as unknown as AuctionWithSeller[]),
        ]);
        setLastId(response.data.lastId);
        if (!response.data.lastId || response.data.auctions.length < 12) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more auctions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-12 flex justify-center">
          <button
            onClick={loadNextPage}
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                Loading...
              </>
            ) : (
              "Load More Auctions"
            )}
          </button>
        </div>
      )}
    </>
  );
}
