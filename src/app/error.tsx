'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { log } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to our internal logging system
    log.error('[GlobalError] Unhandled runtime error:', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      
      <h1 className="font-heading font-bold text-3xl text-gray-900 mb-2">
        Something went wrong
      </h1>
      
      <p className="text-gray-500 max-w-sm mb-8 text-sm leading-relaxed">
        An unexpected error occurred while processing your request. 
        Our team has been notified and we&apos;re looking into it.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => reset()}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-md transition-all shadow-sm text-sm flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
        
        <Link
          href="/"
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-8 py-3 rounded-md transition-all text-sm flex items-center justify-center"
        >
          Return Home
        </Link>
      </div>
      
      {error.digest && (
        <p className="mt-8 text-[11px] font-mono text-gray-300 uppercase tracking-wide">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
