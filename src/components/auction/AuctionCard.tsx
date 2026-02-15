'use client';

import Link from 'next/link';
import { Clock, Users } from 'lucide-react';
import { formatBDT } from '@/lib/format';
import { CountdownTimer } from './CountdownTimer';
import type { AuctionWithSeller } from '@/types';

interface AuctionCardProps {
  auction: AuctionWithSeller;
}

export function AuctionCard({ auction }: AuctionCardProps) {
  const bidCount = auction._count?.bids ?? 0;

  return (
    <Link href={`/auctions/${auction.id}`} className="group">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group-hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          {auction.images[0] ? (
            <img
              src={auction.images[0]}
              alt={auction.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <span className="text-4xl">📦</span>
            </div>
          )}
          {/* Status badge */}
          <div className="absolute top-3 left-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              auction.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {auction.status === 'active' ? 'Live' : auction.status}
            </span>
          </div>
          {/* Category */}
          <div className="absolute top-3 right-3">
            <span className="bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full text-xs font-medium">
              {auction.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-heading font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {auction.title}
          </h3>

          {/* Price */}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="price text-xl text-primary-700">{formatBDT(auction.currentPrice)}</span>
            {auction.currentPrice > auction.startingPrice && (
              <span className="text-xs text-gray-400 line-through">{formatBDT(auction.startingPrice)}</span>
            )}
          </div>

          {/* Meta */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <CountdownTimer endTime={auction.endTime} className="text-xs" />
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{bidCount} bid{bidCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
