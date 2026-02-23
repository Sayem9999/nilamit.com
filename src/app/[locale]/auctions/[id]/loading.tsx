export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <div className="aspect-square bg-gray-200 rounded-3xl animate-pulse" />
          <div className="space-y-3">
            <div className="h-6 bg-gray-200 rounded-lg animate-pulse w-2/3" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="lg:w-96 space-y-6">
          <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
