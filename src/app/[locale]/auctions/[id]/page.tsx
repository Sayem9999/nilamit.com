import { getAuction } from "@/actions/auction";
export const dynamic = "force-dynamic";

import { getAuctionBids } from "@/actions/bid";
import { formatBDT, formatRelativeTime } from "@/lib/format";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import BidPanelWrapper from "@/components/auction/BidPanelWrapper";
import { StickyBidBar } from "@/components/auction/StickyBidBar";
import { ImageGallery } from "@/components/auction/ImageGallery";
import Image from "next/image";
import {
  Clock,
  Users,
  Eye,
  Shield,
  User,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { canReviewAuction } from "@/actions/review";
import { ReviewForm } from "@/components/review/ReviewForm";
import { auth } from "@/lib/auth";
import { WatchlistButton } from "@/components/auction/WatchlistButton";
import { isWatched } from "@/actions/watchlist";
import { ReportModal } from "@/components/auction/ReportModal";
import { ShareButton } from "@/components/auction/ShareButton";
import { BidHistory } from "@/components/auction/BidHistory";
import PriceAlertButton from "@/components/auction/PriceAlertButton";
import UserBadge from "@/components/social/UserBadge";
import { Metadata } from "next";
import Script from "next/script";
import { AuctionStatus } from "@prisma/client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const auction = await getAuction(id);

  if (!auction) return { title: "Auction Not Found" };

  const ogUrl = new URL(`${process.env.NEXTAUTH_URL}/api/og`);
  ogUrl.searchParams.set("title", auction.title);
  ogUrl.searchParams.set("price", auction.currentPrice.toString());
  if (auction.images[0]) ogUrl.searchParams.set("image", auction.images[0]);
  ogUrl.searchParams.set("location", auction.location || "Bangladesh");

  return {
    title: `${auction.title} | Nilamit Auction`,
    description: auction.description.substring(0, 160),
    openGraph: {
      title: auction.title,
      description: auction.description.substring(0, 160),
      images: [{ url: ogUrl.toString() }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
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
    isWatched(id),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: auction.title,
    description: auction.description,
    image: auction.images[0],
    offers: {
      "@type": "Offer",
      price: auction.currentPrice,
      priceCurrency: "BDT",
      availability:
        auction.status === "ACTIVE"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      <Script
        id="auction-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StickyBidBar
        currentPrice={auction.currentPrice}
        endTime={auction.endTime}
        targetId="mobile-bid-anchor"
      />
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Details */}
        <div className="flex-1">
          {/* Image Gallery */}
          <div className="mb-6">
            <ImageGallery images={auction.images} title={auction.title} />
          </div>

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
              <div className="flex items-center gap-2">
                <ShareButton
                  title={auction.title}
                  auctionId={id}
                  price={auction.currentPrice}
                />
                <WatchlistButton
                  auctionId={id}
                  initialIsWatchlisted={watched}
                />
              </div>
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
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-3">
              Description
            </h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {auction.description}
            </p>
          </div>

          {/* Bid History */}
          <BidHistory
            auctionId={id}
            initialBids={bids.map((b) => ({
              id: b.id,
              amount: b.amount,
              createdAt: b.createdAt.toString(),
              bidder: { name: b.bidder.name, id: b.bidder.id },
            }))}
          />

          {/* Review Section (Phase 3) */}
          {auction.status === AuctionStatus.SOLD && (
            <div className="mt-12 pt-12 border-t border-gray-100">
              {(await canReviewAuction(id)) ? (
                <div className="max-w-2xl">
                  <ReviewForm
                    auctionId={id}
                    toId={
                      session?.user?.id === auction.sellerId
                        ? auction.winnerId || ""
                        : auction.sellerId
                    }
                    recipientName={
                      session?.user?.id === auction.sellerId
                        ? auction.winner?.name || "Winner"
                        : auction.seller.name || "Seller"
                    }
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-6 flex items-center gap-4 text-gray-500">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <p className="font-medium">
                    Transaction complete. feedback has been recorded.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Bid Panel + Seller Info */}
        <div id="mobile-bid-anchor" className="lg:w-96 flex-shrink-0 space-y-6">
          {/* Price Card */}
          <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-2xl p-6">
            <p className="text-xs font-medium text-primary-600 mb-1">
              Current Bid
            </p>
            <p className="price text-3xl text-primary-700 mb-2">
              {formatBDT(auction.currentPrice)}
            </p>
            <p className="text-xs text-gray-400">
              Started at {formatBDT(auction.startingPrice)}
            </p>
            <div className="mt-4 pt-4 border-t border-primary-100/50">
              <PriceAlertButton
                auctionId={id}
                currentPrice={auction.currentPrice}
              />
            </div>
          </div>

          {/* Bid Panel */}
          <BidPanelWrapper
            auctionId={id}
            currentPrice={auction.currentPrice}
            minBidIncrement={auction.minBidIncrement}
            endTime={auction.endTime}
            isExpired={new Date() >= new Date(auction.endTime)}
            sellerId={auction.sellerId}
            reservePrice={auction.reservePrice}
            buyItNowPrice={auction.buyItNowPrice}
          />

          {/* Seller Info */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-4">
              Seller
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                {auction.seller?.image ? (
                  <Image
                    src={auction.seller.image}
                    alt={auction.seller.name || "Seller"}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 flex items-center gap-1.5">
                  {auction.seller?.name || "Seller"}
                  {(auction.seller as unknown as { isVerifiedSeller?: boolean })?.isVerifiedSeller && (
                    <Shield className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                  )}
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  <UserBadge
                    level={(auction.seller as unknown as { userLevel?: number })?.userLevel || 1}
                    streak={(auction.seller as unknown as { winningStreak?: number })?.winningStreak || 0}
                    reputation={auction.seller?.reputationScore || 0}
                  />
                  {auction.seller?.isPhoneVerified && (
                    <span className="flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase tracking-tight">
                      <CheckCircle className="w-3 h-3" /> Verified Phone
                    </span>
                  )}
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
