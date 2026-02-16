import { getAuction } from '@/actions/auction';
import { getAuctionBids } from '@/actions/bid';
import { notFound } from 'next/navigation';
import { formatBDT, formatRelativeTime } from '@/lib/format';
import { CountdownTimer } from '@/components/auction/CountdownTimer';
import BidPanelWrapper from '@/components/auction/BidPanelWrapper';
import { Clock, Users, Eye, Shield, User, Star } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  const auction = await getAuction(id);

  if (!auction) notFound();

  const bids = await getAuctionBids(id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Details */}
        <div className="flex-1">
          {/* Image Gallery */}
          <div className="bg-gray-100 rounded-2xl overflow-hidden aspect-[16/10] mb-6">
            {auction.images[0] ? (
              <img
                src={auction.images[0]}
                alt={auction.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <span className="text-6xl">📦</span>
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {auction.images.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {auction.images.map((img, i) => (
                <div key={i} className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-transparent hover:border-primary-400 transition-colors cursor-pointer">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Title & Meta */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                auction.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {auction.status === 'active' ? '🟢 Live' : auction.status}
              </span>
              <span className="bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full text-xs font-medium">
                {auction.category}
              </span>
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900 mb-3">
              {auction.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <CountdownTimer endTime={auction.endTime} />
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {auction._count?.bids || 0} bids
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                Listed {formatRelativeTime(auction.createdAt)}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-3">Description</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{auction.description}</p>
          </div>

          {/* Bid History */}
          <div>
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4">
              Bid History ({bids.length})
            </h2>
            {bids.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <p className="text-gray-400">No bids yet. Be the first!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bids.map((bid, i) => (
                  <div
                    key={bid.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                      i === 0 ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        {bid.bidder.image ? (
                          <img src={bid.bidder.image} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <User className="w-4 h-4 text-primary-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">{bid.bidder.name || 'Anonymous'}</p>
                        <p className="text-xs text-gray-400">{formatRelativeTime(bid.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`price text-sm ${i === 0 ? 'text-primary-700 font-bold' : 'text-gray-600'}`}>
                      {formatBDT(bid.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Bid Panel + Seller Info */}
        <div className="lg:w-96 flex-shrink-0 space-y-6">
          {/* Price Card */}
          <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-6">
            <p className="text-xs font-medium text-primary-600 mb-1">Current Bid</p>
            <p className="price text-3xl text-primary-700 mb-2">{formatBDT(auction.currentPrice)}</p>
            <p className="text-xs text-gray-400">Started at {formatBDT(auction.startingPrice)}</p>
          </div>

          {/* Bid Panel */}
          <BidPanelWrapper
            auctionId={auction.id}
            currentPrice={auction.currentPrice}
            minBidIncrement={auction.minBidIncrement}
            endTime={auction.endTime}
            isExpired={new Date() >= new Date(auction.endTime)}
            sellerId={auction.sellerId}
          />

          {/* Seller Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-4">Seller</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                {auction.seller.image ? (
                  <img src={auction.seller.image} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <User className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{auction.seller.name || 'Seller'}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {auction.seller.isPhoneVerified && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Shield className="w-3 h-3" /> Verified
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3" /> {auction.seller.reputationScore} rep
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
