"use client";

import { useState, useEffect, useTransition } from "react";
import { listMySavedSearches, deleteSavedSearch, type SavedSearch } from "@/actions/saved-search";
import { Search, Bell, Trash2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

/**
 * Saved-searches dashboard tab.
 *
 * Lists the user's stored filter combos with a one-click "Open in /auctions"
 * link (rebuilds the search query string) and a delete button. New-search
 * creation happens on /auctions via a "Save this search" button (TODO),
 * not in this tab — this is purely the management surface.
 */
export function SavedSearchesList() {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      try {
        const res = await listMySavedSearches();
        if (res.success && res.data) setItems(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSavedSearch(id);
      if (res.success) {
        setItems((prev) => prev.filter((s) => s.id !== id));
        toast.success("Saved search removed");
      } else {
        toast.error(res.error?.message || "Could not remove");
      }
    });
  };

  /** Translate the stored filter shape back into a /auctions URL. */
  const toAuctionsHref = (s: SavedSearch): string => {
    const params = new URLSearchParams();
    if (s.filters.search) params.set("search", s.filters.search);
    if (s.filters.category) params.set("category", s.filters.category);
    if (s.filters.location) params.set("location", s.filters.location);
    if (s.filters.condition) params.set("condition", s.filters.condition);
    return `/auctions${params.toString() ? `?${params.toString()}` : ""}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="mt-3 text-sm">Loading your saved searches…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h3 className="font-bold text-gray-900 text-base">No saved searches yet</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          On the auctions page, refine a search and click <span className="font-semibold">Save this search</span>.
          We&apos;ll notify you when new matches appear.
        </p>
        <Link
          href="/auctions"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-md transition-colors"
        >
          Browse auctions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">Saved Searches</h2>
        <span className="text-xs font-semibold text-gray-500">
          {items.length} of 50
        </span>
      </div>

      {items.map((s) => (
        <div
          key={s.id}
          className="bg-white border border-gray-200 rounded-md p-4 flex items-start gap-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{s.label}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
              {s.filters.search && (
                <FilterChip label="search" value={s.filters.search} />
              )}
              {s.filters.category && (
                <FilterChip label="category" value={s.filters.category} />
              )}
              {s.filters.location && (
                <FilterChip label="location" value={s.filters.location} />
              )}
              {s.filters.condition && (
                <FilterChip label="condition" value={s.filters.condition} />
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
              <Bell className="w-3 h-3" />
              Notify via{" "}
              <span className="font-semibold">
                {[
                  s.notify.inApp && "in-app",
                  s.notify.fcm && "push",
                  s.notify.email && "email",
                ]
                  .filter(Boolean)
                  .join(" + ") || "none"}
              </span>
              {" · "}
              {s.matchCount ? `${s.matchCount} matches sent` : "no matches yet"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <Link
              href={toAuctionsHref(s)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[11px] font-bold rounded transition-colors"
              title="Open these results"
            >
              Open <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={() => handleDelete(s.id)}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
      <span className="text-gray-400">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
