import { getAuction } from '@/actions/auction';
import { getAuctionBids } from '@/actions/bid';
import { formatBDT, formatRelativeTime } from '@/lib/format';
import { CountdownTimer } from '@/components/auction/CountdownTimer';
import BidPanelWrapper from '@/components/auction/BidPanelWrapper';
import { StickyBidBar } from '@/components/auction/StickyBidBar';
import { Clock, Users, Eye, Shield, User, Star, CheckCircle, TrendingUp } from 'lucide-react';
import { canReviewAuction } from '@/actions/review';
import { ReviewForm } from '@/components/review/ReviewForm';
import { auth } from '@/lib/auth';
import { WatchlistButton } from '@/components/auction/WatchlistButton';
import { isWatched } from '@/actions/watchlist';
import { ReportModal } from '@/components/auction/ReportModal';
import { Metadata } from 'next';
import Script from 'next/script';
import { AuctionStatus } from '@prisma/client';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const auction = await getAuction(id);
  
  if (!auction) return { title: 'Auction Not Found' };

  const ogUrl = new URL(`${process.env.NEXTAUTH_URL}/api/og`);
  ogUrl.searchParams.set('title', auction.title);
  ogUrl.searchParams.set('price', auction.currentPrice.toString());
  if (auction.images[0]) ogUrl.searchParams.set('image', auction.images[0]);
  ogUrl.searchParams.set('location', auction.location || 'Bangladesh');

  return {
    title: `${auction.title} | Nilamit Auction`,
    description: auction.description.substring(0, 160),
    openGraph: {
      title: auction.title,
      description: auction.description.substring(0, 160),
      images: [{ url: ogUrl.toString() }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: auction.title,
      description: auction.description.substring(0, 160),
      images: [ogUrl.toString()],
    },
  };
}

export default async function AuctionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const auction = await getAuction(id);
  if (!auction) return <div>Auction not found</div>;

  const [bids, watched] = await Promise.all([
    getAuctionBids(id),
    isWatched(id)
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: auction.title,
    description: auction.description,
    image: auction.images[0],
    offers: {
      '@type': 'Offer',
      price: auction.currentPrice,
      priceCurrency: 'BDT',
      availability: auction.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      <Script
        id="auction-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StickyBidBar currentPrice={auction.currentPrice} targetId="mobile-bid-anchor" />
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
            <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wider mb-2">
                <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded-md border border-primary-100">
                  {auction.category}
                </span>
                {auction.location && (
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200">
                    📍 {auction.location}
                  </span>
                )}
                {auction.status === AuctionStatus.ACTIVE && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold animate-pulse">
          <TrendingUp className="w-3.5 h-3.5" /> LIVE
        </div>
      )}
              </div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-gray-900">
                {auction.title}
              </h1>
              <WatchlistButton auctionId={id} initialIsWatched={watched} />
            </div>
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
                          <img src={bid.bidder.image} alt={bid.bidder.name || 'Bidder'} className="w-8 h-8 rounded-full" />
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

          {/* Review Section (Phase 3) */}
          {auction.status === AuctionStatus.SOLD && (
            <div className="mt-12 pt-12 border-t border-gray-100">
              {await canReviewAuction(id) ? (
                <div className="max-w-2xl">
                  <ReviewForm 
                    auctionId={id} 
                    toId={session?.user?.id === auction.sellerId ? (auction.winnerId || '') : auction.sellerId}
                    recipientName={session?.user?.id === auction.sellerId ? (auction.winner?.name || 'Winner') : (auction.seller.name || 'Seller')}
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-6 flex items-center gap-4 text-gray-500">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <p className="font-medium">Transaction complete. feedback has been recorded.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Bid Panel + Seller Info */}
        <div id="mobile-bid-anchor" className="lg:w-96 flex-shrink-0 space-y-6">
          {/* Price Card */}
          <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-6">
            <p className="text-xs font-medium text-primary-600 mb-1">Current Bid</p>
            <p className="price text-3xl text-primary-700 mb-2">{formatBDT(auction.currentPrice)}</p>
            <p className="text-xs text-gray-400">Started at {formatBDT(auction.startingPrice)}</p>
          </div>

          {/* Bid Panel */}
          <BidPanelWrapper
            auctionId={id}
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
                {auction.seller?.image ? (
                  <img src={auction.seller.image} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <User className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 flex items-center gap-1.5">
                  {(auction as any).seller?.name || 'Seller'}
                  {(auction as any).seller?.isVerifiedSeller && (
                    <Shield className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {auction.seller?.isPhoneVerified && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle className="w-3 h-3" /> Verified Phone
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3" /> {auction.seller?.reputationScore || 0} rep
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center border-t border-gray-50 pt-2">
            <ReportModal auctionId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
