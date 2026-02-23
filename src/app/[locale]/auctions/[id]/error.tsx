"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h2 className="font-heading font-bold text-xl text-gray-900 mb-2">
        Auction could not be loaded
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        {error.message || "Something went wrong loading this auction."}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={reset}
          className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/auctions"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          Browse Auctions
        </Link>
      </div>
    </div>
  );
}
