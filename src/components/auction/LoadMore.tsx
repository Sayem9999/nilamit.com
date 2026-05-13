"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getAuctions } from "@/actions/auction";
import type { AuctionWithSeller, AuctionFilters } from "@/types";
import AuctionCard from "./AuctionCard";
import { Loader2 } from "lucide-react";

interface LoadMoreProps {
  filters: AuctionFilters;
  initialLastId: string | null;
}

export default function LoadMore({
  filters,
  initialLastId,
}: LoadMoreProps) {
  const [auctions, setAuctions] = useState<AuctionWithSeller[]>([]);
  const [lastId, setLastId] = useState<string | null>(initialLastId);
  const [hasMore, setHasMore] = useState(initialLastId !== null);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef(null);

  const loadNextPage = useCallback(async () => {
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
  }, [filters, lastId, hasMore, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [lastId, hasMore, isLoading, loadNextPage]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </div>

      {/* Intersection Observer Target */}
      <div ref={observerTarget} className="h-10 w-full flex justify-center items-center">
        {isLoading && (
          <div className="flex items-center gap-2 text-primary-600 font-medium">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
        {!hasMore && auctions.length > 0 && (
          <p className="text-gray-400 text-sm italic">You&apos;ve reached the end of the line.</p>
        )}
      </div>
    </div>
  );
}
