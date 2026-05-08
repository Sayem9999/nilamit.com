import Link from "next/link";
import { Gavel } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Gavel className="w-10 h-10 text-white" />
      </div>
      <h1 className="font-heading font-bold text-6xl text-gray-900 mb-2">
        404
      </h1>
      <h2 className="font-heading font-semibold text-xl text-gray-600 mb-4">
        Page Not Found
      </h2>
      <p className="text-gray-400 max-w-sm mb-8 text-sm leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm text-sm"
        >
          Go Home
        </Link>
        <Link
          href="/auctions"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-8 py-3 rounded-xl transition-all text-sm"
        >
          Browse Auctions
        </Link>
      </div>
    </div>
  );
}
