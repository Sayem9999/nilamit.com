import { Skeleton } from "@/components/ui/skeleton";

export default function AuctionDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Gallery Skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="aspect-video w-full rounded-md" />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-24 h-24 rounded-xl" />
            ))}
          </div>
          <div className="bg-white p-6 rounded-md border border-gray-100 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="lg:w-96 space-y-6">
          <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <div className="flex gap-2">
                 <Skeleton className="h-10 flex-1 rounded-lg" />
                 <Skeleton className="h-10 flex-1 rounded-lg" />
                 <Skeleton className="h-10 flex-1 rounded-lg" />
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-md border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
