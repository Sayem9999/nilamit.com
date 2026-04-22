import { getAuction } from "@/actions/auction";
export const dynamic = "force-dynamic";

import { getAuctionBids } from "@/actions/bid";
import { formatBDT, formatRelativeTime } from "@/lib/format";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import BidPanelWrapper from "@/components/auction/BidPanelWrapper";
import { StickyBidBar } from "@/components/auction/StickyBidBar";
import { ImageGallery } from "@/components/auction/ImageGallery";
import PriceAlertButton from "@/components/auction/PriceAlertButton";
import Image from "next/image";
import {
  Clock,
  Users,
  Eye,
  Shield,
  User,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Truck,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { canReviewAuction } from "@/actions/review";
import { ReviewForm } from "@/components/review/ReviewForm";
import { auth } from "@/lib/auth";
import { WatchlistButton } from "@/components/auction/WatchlistButton";
import { isWatched } from "@/actions/watchlist";
import { ReportModal } from "@/components/auction/ReportModal";
import { ShareButton } from "@/components/auction/ShareButton";
import { BidHistory } from "@/components/auction/BidHistory";
import UserBadge from "@/components/social/UserBadge";
import { GatedContactInfo } from "@/components/ui/GatedContactInfo";
import { getAuctionChat } from "@/actions/chat";
import ChatInterface from "@/components/social/ChatInterface";
import { Metadata } from "next";
import Script from "next/script";
import { AuctionWithBids, AuctionStatus } from "@/types";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const auction = await getAuction(id) as AuctionWithBids | null;

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
  const auction = await getAuction(id) as AuctionWithBids | null;
  const t = await getTranslations("Auction");
  if (!auction) return <div className="min-h-[50vh] flex items-center justify-center font-bold text-gray-500 uppercase tracking-widest">{t("notFound")}</div>;

  const [bids, watched, chat] = await Promise.all([
    getAuctionBids(id),
    isWatched(id),
    getAuctionChat(id)
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
                  <TrendingUp className="w-3.5 h-3.5" /> {t("live")}
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
                {auction._count?.bids || 0} {t("bids")}
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {t("listed")} {formatRelativeTime(auction.createdAt)}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="font-heading font-semibold text-lg text-gray-900 mb-3">
              {t("description")}
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
                        ? auction.winner?.name || t("winnerFallback")
                        : auction.seller.name || t("sellerFallback")
                    }
                  />
                </div>
              ) : (
                <div className="bg-gray-50 rounded-2xl p-6 flex items-center gap-4 text-gray-500">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <p className="font-bold uppercase tracking-tight text-xs">
                    {t("feedbackRecorded")}
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
              {t("currentPrice")}
            </p>
            <p className="price text-3xl text-primary-700 mb-2">
              {formatBDT(auction.currentPrice)}
            </p>
            <p className="text-xs text-gray-400">
              {t("startingPrice")} {formatBDT(auction.startingPrice)}
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
              {t("seller")}
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                {auction.seller?.image ? (
                  <Image
                    src={auction.seller.image}
                    alt={auction.seller.name || t("sellerFallback")}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                  {auction.seller?.name || t("sellerFallback")}
                  {auction.seller?.isVerifiedSeller && (
                    <Shield className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                  )}
                </p>
                
                {/* Contact Gating Logic */}
                {auction.status === AuctionStatus.SOLD && (session?.user?.id === auction.winnerId || session?.user?.id === auction.sellerId) && (
                  <div className="mt-3 space-y-2">
                    <GatedContactInfo 
                      status={auction.escrowTransaction?.status}
                      transactionId={auction.escrowTransaction?.id}
                      label={t("sellerPhone")}
                      value={auction.seller?.phone || "N/A"}
                      type="phone"
                      isVerified={auction.seller?.isVerifiedSeller}
                    />
                    <GatedContactInfo 
                      status={auction.escrowTransaction?.status}
                      transactionId={auction.escrowTransaction?.id}
                      label={t("pickupLocation")}
                      value={auction.location || "N/A"}
                      type="address"
                      isVerified={auction.seller?.isVerifiedSeller}
                    />

                    {/* Coordination Chat */}
                    {chat && (
                      <div className="mt-6">
                        <ChatInterface 
                          auctionId={id}
                          conversationId={chat.id}
                          initialMessages={chat.messages}
                          recipientName={
                            session?.user?.id === chat.buyerId 
                              ? chat.auction.seller.name || t("sellerFallback")
                              : chat.auction.winner?.name || t("buyerFallback")
                          }
                          recipientImage={
                            session?.user?.id === chat.buyerId 
                              ? chat.auction.seller.image
                              : chat.auction.winner?.image
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <UserBadge
                    level={auction.seller?.userLevel || 1}
                    streak={auction.seller?.winningStreak || 0}
                    reputation={auction.seller?.reputationScore || 0}
                  />
                  {auction.seller?.isPhoneVerified && (
                    <span className="flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase tracking-tight">
                      <CheckCircle className="w-3 h-3" /> {t("verifiedPhone")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary Card (Seller/Winner only) */}
          {auction.status === AuctionStatus.SOLD && (session?.user?.id === auction.winnerId || session?.user?.id === auction.sellerId) && (
            <Card className="border-primary-100 bg-primary-50/30 overflow-hidden">
              <CardHeader className="bg-white/50 py-3 border-b border-primary-100">
                <CardTitle className="text-sm flex items-center gap-2 text-primary-800">
                  <DollarSign className="w-4 h-4" /> {t("financialSummary")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">{t("grossSale")}</span>
                  <span className="text-sm font-bold text-slate-900">{formatBDT(auction.currentPrice)}</span>
                </div>
                
                <div className="flex justify-between items-center p-2 bg-white rounded border border-primary-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-primary-600 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> {t("successFee")}
                    </span>
                    <span className="text-[9px] text-slate-400">{t("platformCommission")}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary-700">-{formatBDT(auction.commissionEarned || 0)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Truck className="w-3 h-3" /> {t("deliveryCharge")}
                    </span>
                    <span className="text-[9px] text-slate-400">{t("sellerProtection")}</span>
                  </div>
                   <span className="text-sm font-semibold text-slate-700">{formatBDT(auction.deliveryCharge || 0)}</span>
                </div>

                <div className="pt-2 border-t border-primary-100 flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-900">{t("totalAdvance")}</span>
                   <span className="text-lg font-black text-blue-600">
                     {formatBDT((auction.commissionEarned || 0) + (auction.deliveryCharge || 0))}
                   </span>
                </div>
                
                <div className="p-2 bg-blue-50 rounded text-[10px] text-blue-700 flex items-start gap-2">
                  <Info className="w-3 h-3 mt-0.5" />
                  <p>{t("advanceUnlockNote", { amount: formatBDT(auction.currentPrice - (auction.commissionEarned || 0)) })}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center border-t border-gray-50 pt-2">
            <ReportModal auctionId={id} />
          </div>

          <div className="mt-8 p-4 bg-gray-50/50 rounded-xl border border-gray-100/50">
            <p className="text-[10px] text-gray-400 leading-tight text-center italic">
              Nilamit is a marketplace facilitator. By bidding or listing, you agree to our 18+ eligibility rule and the binding nature of bids under the ICT Act 2006.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
