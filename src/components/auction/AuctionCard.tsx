'use client';

import Link from 'next/link';
import { Shield, Clock, Users, Zap, MapPin, Star } from 'lucide-react';
import { formatBDT } from '@/lib/format';
import { CountdownTimer } from './CountdownTimer';
import type { AuctionWithSeller } from '@/types';
import { useSettings } from '@/context/SettingsContext';

export default function AuctionCard({ auction }: { auction: AuctionWithSeller }) {
  const { lightweightMode } = useSettings();
  const mainImage = auction.images[0] || '/placeholder.png';
  const bidCount = auction._count?.bids ?? 0;

  return (
    <Link href={`/auctions/${auction.id}`} className="group">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group-hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
          {lightweightMode ? (
            <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <Zap className="w-8 h-8 text-amber-500 animate-pulse" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Lite Mode Active</span>
            </div>
          ) : (
            auction.images[0] ? (
              <img
                src={mainImage}
                alt={auction.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <span className="text-4xl">📦</span>
              </div>
            )
          )}
          {/* Status badge */}
          <div className="absolute top-3 left-3">
            <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
              (auction as any).status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {(auction as any).status === 'ACTIVE' ? 'Live' : (auction as any).status}
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
        <div className="p-3 sm:p-4">
          <h3 className="font-heading font-semibold text-gray-900 text-sm sm:text-base line-clamp-1 group-hover:text-primary-600 transition-colors">
            {auction.title}
          </h3>

          <div className="flex items-center gap-1 min-w-0 mt-0.5">
            <span className="text-[10px] sm:text-xs font-semibold text-gray-700 truncate">{auction.seller.name || 'Seller'}</span>
            {auction.seller.isVerifiedSeller && (
              <Shield className="w-3 h-3 text-blue-500 fill-blue-500/10 flex-shrink-0" />
            )}
            {auction.seller.reputationScore > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5 fill-amber-600" />
                {auction.seller.reputationScore}
              </div>
            )}
            {auction.location && (
              <div className="hidden sm:flex items-center gap-0.5 text-xs text-gray-400 ml-auto">
                <MapPin className="w-2.5 h-2.5" />
                <span className="capitalize">{auction.location}</span>
              </div>
            )}
          </div>
          {/* Price */}
          <div className="mt-1 sm:mt-2 flex items-baseline gap-1.5">
            <span className="price text-lg sm:text-xl text-primary-700">{formatBDT(auction.currentPrice)}</span>
            {auction.currentPrice > auction.startingPrice && (
              <span className="text-[10px] sm:text-xs text-gray-400 line-through">{formatBDT(auction.startingPrice)}</span>
            )}
          </div>

          {/* Meta */}
          <div className="mt-2 sm:mt-3 flex items-center justify-between text-[10px] sm:text-xs text-gray-500 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <CountdownTimer endTime={auction.endTime} className="text-[10px] sm:text-xs font-bold" />
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
