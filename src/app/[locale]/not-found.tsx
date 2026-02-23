'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { Gavel } from 'lucide-react';

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-6">
        <Gavel className="w-8 h-8 text-primary-600" />
      </div>
      <h1 className="font-heading font-bold text-4xl text-gray-900 mb-2">404</h1>
      <h2 className="font-heading font-semibold text-xl text-gray-700 mb-6">Page Not Found</h2>
      <p className="text-gray-500 max-w-sm mb-8">
        Oops! The page you are looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm"
      >
        Go Home
      </Link>
    </div>
  );
}
