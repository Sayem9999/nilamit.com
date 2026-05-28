import { Skeleton } from "@/components/ui/skeleton";

export default function AuctionsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 flex-shrink-0 space-y-8">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-4">
             <Skeleton className="h-4 w-24" />
             <div className="space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
             </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-md border border-gray-100 p-4 space-y-4 shadow-sm">
                <Skeleton className="aspect-square w-full rounded-xl" />
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
      </div>
    </div>
  );
}
