import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reusable listing-grid skeleton — matches the AuctionCard grid so the page
 * doesn't reflow when real data arrives. Used by the route-level loading.tsx
 * files for the browse/search/category surfaces.
 *
 * Why this exists: the data lives in US (nam5) and most users are in BD, so the
 * fetch round-trip is long. A skeleton turns a blank screen into perceived
 * progress on the slow paths (see docs/PERFORMANCE.md).
 */
export function GridSkeleton({ count = 9, withHeader = true }: { count?: number; withHeader?: boolean }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {withHeader && (
        <div className="mb-8">
          <Skeleton className="h-9 w-56 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-md border border-gray-100 p-4 space-y-4 shadow-sm">
            <Skeleton className="aspect-square w-full rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Profile / seller header skeleton + a grid below. */
export function ProfileSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <GridSkeleton count={6} withHeader={false} />
    </div>
  );
}

/** Vertical list skeleton (leaderboard / social feed). */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
      <Skeleton className="h-9 w-56 mb-6" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-white rounded-md border border-gray-100 p-4 shadow-sm">
          <Skeleton className="h-12 w-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}
