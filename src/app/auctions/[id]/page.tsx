import { getAuction, getAuctions } from "@/actions/auction";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
export const dynamic = "force-dynamic";

import { getAuctionBids } from "@/actions/bid";
import { formatBDT, formatRelativeTime } from "@/lib/format";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import BidPanelWrapper from "@/components/auction/BidPanelWrapper";
import { StickyBidBar } from "@/components/auction/StickyBidBar";
import { ImageGallery } from "@/components/auction/ImageGallery";
import { AuctionViewTracker } from "@/components/auction/AuctionViewTracker";
import Image from "next/image";
import {
  Eye,
  Shield,
  User,
  Star,
  CheckCircle,
  DollarSign,
  Truck,
  Info,
  MapPin,
  Flame,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AuctionDetailTabs } from "@/components/auction/AuctionDetailTabs";
import { calculateSuccessFee } from "@/services/finance/commission";
import { canReviewAuction } from "@/actions/review";
import { getAuctionQuestions } from "@/actions/qa";
import { getSystemConfig } from "@/actions/admin-content";
import { QnaSection } from "@/components/auction/QnaSection";
// Static imports — `dynamic({ ssr: false })` is no longer permitted from
// Server Components in Next.js 16, and these are all client components so
// Next handles the client/server boundary on its own.
// Dynamic imports for heavy interactive components to optimize initial load
import { BidHistory } from "@/components/auction/BidHistory";
import { ReviewForm } from "@/components/review/ReviewForm";
import { ReportModal } from "@/components/auction/ReportModal";
import ChatInterface from "@/components/social/ChatInterface";
import { isAdminEmail } from "@/lib/admin-guard";
import { AdminAuctionControls } from "@/components/auction/AdminAuctionControls";
import { FeatureListingButton } from "@/components/auction/FeatureListingButton";

import { AuctionWithBids, Bid, AuctionWithSeller } from "@/types";
import { auth } from "@/lib/auth";
import { WatchlistButton } from "@/components/auction/WatchlistButton";
import { DetailFeatureButton } from "@/components/auction/DetailFeatureButton";
import { isWatched } from "@/actions/watchlist";
import { ShareButton } from "@/components/auction/ShareButton";
import UserBadge from "@/components/social/UserBadge";
import { getProxiedAvatarUrl } from "@/lib/avatar";
import { GatedContactInfo } from "@/components/ui/GatedContactInfo";
import { getAuctionChat } from "@/actions/chat";
import { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ErrorType, errorResponse } from "@/lib/errors";
import { AuctionStatus } from "@/types";
import { SecondChanceOfferButton } from "@/components/auction/SecondChanceOfferButton";
import { AuctionStatusBadge } from "@/components/auction/AuctionStatusBadge";
import { AuctionBidCount } from "@/components/auction/AuctionBidCount";
import { StartChatButton } from "@/components/social/StartChatButton";
import AuctionCard from "@/components/auction/AuctionCard";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const response = await getAuction(id);
  const auction = (response.success && response.data) ? response.data as AuctionWithBids : null;

  if (!auction) return { title: "Auction Not Found" };

  const rawBaseUrl = (env.NEXTAUTH_URL?.replace(/\/$/, "") || "https://nilamit.com");
  let baseUrl = rawBaseUrl;
  let ogUrl: URL;
  try {
    ogUrl = new URL(`${baseUrl}/api/og`);
  } catch {
    console.error(`[AuctionPage] ❌ Invalid baseUrl/ogUrl: "${baseUrl}"`);
    baseUrl = "https://nilamit.com";
    ogUrl = new URL(`${baseUrl}/api/og`);
  }
  ogUrl.searchParams.set("title", auction.title);
  ogUrl.searchParams.set("price", auction.currentPrice.toString());
  if (auction.images[0]) ogUrl.searchParams.set("image", auction.images[0]);
  ogUrl.searchParams.set("location", auction.location || "Bangladesh");

  return {
    title: `${auction.title} | Nilamit Auction`,
    description: auction.description.substring(0, 160),
    alternates: {
      canonical: `${baseUrl}/auctions/${id}`,
    },
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
  const now = new Date();
  const { id } = await params;
  const session = await auth();
  const nonce = (await headers()).get('x-nonce') || undefined;
  const isAdmin = isAdminEmail(session?.user?.email);
  const response = await getAuction(id);
  const auction = (response.success && response.data) ? response.data as AuctionWithBids : null;
  const t = await getTranslations("Auction");
  if (!auction) return <div className="min-h-[50vh] flex items-center justify-center font-bold text-gray-500 uppercase tracking-wide">{t("notFound")}</div>;

  const [bidsRes, watchedRes, chatRes, reviewRes, questionsRes, relatedRes, configRes] = await Promise.all([
    getAuctionBids(id).catch((e) => { log.error('[AuctionDetail] getAuctionBids failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed'); }),
    isWatched(id).catch((e) => { log.error('[AuctionDetail] isWatched failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed') as unknown as Awaited<ReturnType<typeof isWatched>>; }),
    getAuctionChat(id).catch((e) => { log.error('[AuctionDetail] getAuctionChat failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed'); }),
    canReviewAuction(id).catch((e) => { log.error('[AuctionDetail] canReviewAuction failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed'); }),
    getAuctionQuestions(id).catch((e) => { log.error('[AuctionDetail] getAuctionQuestions failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed'); }),
    getAuctions({ category: auction.category, status: AuctionStatus.ACTIVE, limit: 5 }).catch((e) => { log.error('[AuctionDetail] getRelatedAuctions failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed'); }),
    getSystemConfig().catch((e) => { log.error('[AuctionDetail] getSystemConfig failed', e); return errorResponse(ErrorType.INTERNAL, 'Failed'); }),
  ]);

  const bids = (bidsRes.success && bidsRes.data ? bidsRes.data : []) as (Bid & { bidder: { id: string, name: string, image: string | null } })[];
  const watched = (watchedRes.success && watchedRes.data) ? watchedRes.data : false;
  const chat = (chatRes.success && chatRes.data) ? chatRes.data : null;
  const canReview = (reviewRes.success && reviewRes.data) ? reviewRes.data : false;
  const questions = (questionsRes.success && questionsRes.data) ? questionsRes.data : [];
  const relatedAuctions = (relatedRes.success && relatedRes.data?.auctions 
    ? relatedRes.data.auctions.filter(a => a.id !== id) 
    : []).slice(0, 3) as AuctionWithSeller[];
  const systemConfig = (configRes.success && configRes.data) ? configRes.data : null;
  const tLoc = await getTranslations("Locations");

  const bids24h = bids.filter((b) => {
    const bidTime = new Date(b.createdAt);
    return now.getTime() - bidTime.getTime() <= 24 * 60 * 60 * 1000;
  }).length;
  const watchersCount = auction.watchlist?.length ?? 0;

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
      priceValidUntil: auction.endTime.toISOString(),
      itemCondition: "https://schema.org/UsedCondition",
      availability:
        auction.status === "ACTIVE"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  const serverTime = now.toISOString();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      <Script
        id="auction-jsonld"
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ 
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') 
        }}
      />
      <StickyBidBar
        currentPrice={auction.currentPrice}
        endTime={auction.endTime}
        serverTime={serverTime}
        targetId="mobile-bid-anchor"
      />
      {isAdmin && (
        <AdminAuctionControls auctionId={id} auctionTitle={auction.title} />
      )}
      {session?.user?.id === auction.sellerId && auction.status === "ACTIVE" && (
        <div className="mb-8">
          <FeatureListingButton
            auctionId={id}
            isFeatured={!!auction.isFeatured}
            featuredUntil={auction.featuredUntil}
          />
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Details — uniform 8-unit vertical rhythm via space-y */}
        <div className="flex-1 space-y-8">
          {/* Image Gallery */}
          <ImageGallery images={auction.images} title={auction.title} />

          {/* Title & Meta */}
          <div>
            {/* Action row above title — keeps the title on its own line at any width */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wider">
                <span className="bg-primary-50 text-primary-700 px-2.5 py-1 rounded-md border border-primary-100">
                  {auction.category}
                </span>
                {auction.location && (
                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md border border-gray-200">
                    <MapPin className="w-3 h-3" aria-hidden="true" /> {auction.location}
                  </span>
                )}
                <AuctionStatusBadge 
                  auctionId={id}
                  initialStatus={auction.status}
                  initialPrice={auction.currentPrice}
                  initialBidCount={auction._count?.bids || 0}
                  endTime={auction.endTime}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ShareButton
                  title={auction.title}
                  auctionId={id}
                  price={auction.currentPrice}
                />
                <DetailFeatureButton
                  auctionId={id}
                  initialIsFeatured={!!auction.isFeatured}
                  isAdmin={isAdmin}
                />
                <WatchlistButton
                  auctionId={id}
                  initialIsWatchlisted={watched}
                />
              </div>
            </div>

            <h1 className="font-heading font-bold text-2xl sm:text-3xl lg:text-4xl text-gray-900 leading-tight tracking-tight mb-4">
              {auction.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
              <CountdownTimer endTime={auction.endTime} serverTime={serverTime} variant="badge" />
                <AuctionBidCount 
                  auctionId={id}
                  initialBidCount={auction._count?.bids || 0}
                  initialPrice={auction.currentPrice}
                  initialStatus={auction.status}
                />
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" aria-hidden="true" />
                <span>{t("listed")} {formatRelativeTime(auction.createdAt, now)}</span>
              </div>
            </div>
          </div>

          {/* eBay Multi-Tab Details Switcher */}
          {(() => {
            // Shown as a percent. auction.commissionRate is stored as a fraction
            // (e.g. 0.025) at sale time; systemConfig.commissionPercentage is
            // already a percent (e.g. 1.5). For unsold auctions on the default
            // dynamic tiers, estimate the real tiered rate for the current price
            // (the same logic the close flow charges) instead of a flat placeholder.
            const commissionPct =
              auction.commissionRate != null
                ? auction.commissionRate * 100
                : systemConfig?.commissionPercentageEnabled === false
                  ? 0
                  : systemConfig?.commissionPercentage
                    ?? calculateSuccessFee(auction.currentPrice, null).rate * 100;
            const resolvedCommissionRate = Math.round(commissionPct * 100) / 100;
            return (
              <AuctionDetailTabs
                description={auction.description}
                location={auction.location || undefined}
                seller={{
                  id: auction.sellerId,
                  name: auction.seller?.name,
                  image: auction.seller?.image,
                  rating: auction.seller?.rating,
                  ratingCount: auction.seller?.ratingCount,
                  userLevel: auction.seller?.userLevel,
                  winningStreak: auction.seller?.winningStreak,
                  isVerifiedSeller: !!auction.seller?.isVerifiedSeller,
                  isTopRated: !!auction.seller?.isTopRated,
                }}
                commissionRate={resolvedCommissionRate}
              />
            );
          })()}

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

          {/* Public Q&A */}
          <QnaSection
            auctionId={id}
            sellerId={auction.sellerId}
            initialQuestions={questions}
            isActive={auction.status === AuctionStatus.ACTIVE}
          />

          {/* Review Section (Phase 3) */}
          {auction.status === AuctionStatus.SOLD && (
            <section className="pt-8 border-t border-gray-100">
              {canReview ? (
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
                <div className="bg-gray-50 rounded-md p-6 flex items-center gap-4 text-gray-500">
                  <CheckCircle className="w-6 h-6 text-green-500" aria-hidden="true" />
                  <p className="font-bold uppercase tracking-tight text-xs">
                    {t("feedbackRecorded")}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right: Bid Panel + Seller Info */}
        <div id="mobile-bid-anchor" className="lg:w-96 flex-shrink-0 space-y-6">
          {/* eBay Urgency Signals */}
          <div className="flex flex-col gap-2 p-4 bg-orange-50/50 border border-orange-100/60 rounded-md shadow-xs">
            {bids24h > 0 ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-850">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500/20 animate-pulse" />
                <span>🔥 {bids24h} bid{bids24h === 1 ? "" : "s"} placed in the last 24h</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Flame className="w-4 h-4 text-gray-400" />
                <span>Steady bidding activity</span>
              </div>
            )}
            {watchersCount > 0 ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-primary-850">
                <Eye className="w-4 h-4 text-primary-500 animate-pulse" />
                <span>👀 {watchersCount} active watcher{watchersCount === 1 ? "" : "s"} interested</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Eye className="w-4 h-4 text-gray-400" />
                <span>Be the first to watch this item</span>
              </div>
            )}
          </div>

          {/* Fire-and-forget viewCount increment (rate-limited per IP). */}
          <AuctionViewTracker auctionId={id} />

          {/* Bid Panel */}
          <BidPanelWrapper
            auctionId={id}
            currentPrice={auction.currentPrice}
            startingPrice={auction.startingPrice}
            minBidIncrement={auction.minBidIncrement}
            endTime={auction.endTime}
            serverTime={serverTime}
            isExpired={now >= new Date(auction.endTime)}
            sellerId={auction.sellerId}
            reservePrice={auction.reservePrice}
            buyItNowPrice={auction.buyItNowPrice}
            proxyMaxBid={auction.proxyMaxBid}
            proxyBidderId={auction.proxyBidderId}
            initialStatus={auction.status}
            initialBidCount={bids.length}
            initialBiddersCount={new Set(bids.map(b => b.bidder.id)).size}
            initialBids={bids.slice(0, 10).map((b) => ({
              id:         b.id,
              amount:     b.amount,
              endTime:    auction.endTime,
              bidderName: b.bidder.name ?? 'Someone',
              bidderId:   b.bidder.id,
              createdAt:  b.createdAt.toString(),
            }))}
          />

          {/* eBay Specifications Table */}
          <div className="bg-white border border-gray-100 rounded-md p-5 space-y-4 shadow-sm">
            <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
              Item Specifications
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-xs">
              <div className="text-gray-400 font-medium">Condition</div>
              <div className="text-gray-900 font-bold uppercase tracking-wider">
                <span className="bg-slate-100 border border-gray-200/50 rounded px-1.5 py-0.5 text-[10px]">
                  {auction.condition || "Used"}
                </span>
              </div>

              <div className="text-gray-400 font-medium">Category</div>
              <div className="text-gray-900 font-bold uppercase tracking-wider truncate">
                {auction.category}
              </div>

              <div className="text-gray-400 font-medium">Verified Seller</div>
              <div className="text-gray-900 font-bold flex items-center gap-1">
                {auction.seller?.isVerifiedSeller ? (
                  <span className="text-blue-600 font-bold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 fill-blue-500/15" /> Yes
                  </span>
                ) : (
                  <span className="text-gray-500">Standard</span>
                )}
              </div>

              <div className="text-gray-400 font-medium">Divisional Area</div>
              <div className="text-gray-900 font-bold flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-primary-500" />
                {auction.location ? tLoc(auction.location) : "Dhaka"}
              </div>

              <div className="text-gray-400 font-medium">Bidding Policy</div>
              <div className="text-gray-900 font-bold text-primary-600 uppercase tracking-tight flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/20" /> Anti-Snipe
              </div>

              <div className="text-gray-400 font-medium">Reserve Met</div>
              <div className="text-gray-900 font-bold">
                {auction.reservePrice ? (
                  auction.currentPrice >= auction.reservePrice ? (
                    <span className="text-green-600 font-extrabold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Yes
                    </span>
                  ) : (
                    <span className="text-orange-600 font-bold">No</span>
                  )
                ) : (
                  <span className="text-gray-500">No Reserve</span>
                )}
              </div>
            </div>
          </div>

          {/* Seller Info */}
          <div className="bg-white border border-gray-100 rounded-md p-6 space-y-4">
            <h3 className="font-heading font-semibold text-sm text-gray-700 mb-2">
              {t("seller")}
            </h3>
            
            <Link href={`/seller/${auction.sellerId}`} className="group flex items-center gap-3 hover:opacity-95">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                {auction.seller?.image ? (
                  <Image
                    src={getProxiedAvatarUrl(auction.seller.image) || ""}
                    alt={auction.seller.name || t("sellerFallback")}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                ) : (
                  <User className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900 flex items-center gap-1.5 group-hover:text-indigo-650 transition-colors">
                  {auction.seller?.name || t("sellerFallback")}
                  {auction.seller?.isVerifiedSeller && (
                    <Shield className="w-4 h-4 text-blue-500 fill-blue-500/10" />
                  )}
                  {auction.seller?.isTopRated && (
                    <span className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-[10px] font-bold text-amber-700">TOP RATED</span>
                    </span>
                  )}
                </p>
                <span className="text-[10px] text-indigo-600 font-bold tracking-wide block mt-0.5">
                  View Storefront →
                </span>
              </div>
            </Link>

            {/* Seller Badges & Gating */}
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <UserBadge
                  level={auction.seller?.userLevel || 1}
                  streak={auction.seller?.winningStreak || 0}
                  rating={auction.seller?.rating || 0}
                  ratingCount={auction.seller?.ratingCount || 0}
                />
              </div>

              {/* Contact Gating Logic */}
              {auction.status === AuctionStatus.SOLD && (session?.user?.id === auction.winnerId || session?.user?.id === auction.sellerId) && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {session?.user?.id === auction.sellerId && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                      <p className="text-[10px] font-bold text-amber-800 uppercase mb-2">Buyer not responding?</p>
                      <SecondChanceOfferButton auctionId={id} />
                    </div>
                  )}
                  <GatedContactInfo 
                    status={auction.escrowTransaction?.status}
                    transactionId={auction.escrowTransaction?.id}
                    label={t("pickupLocation")}
                    value={auction.location || "N/A"}
                    type="address"
                    isVerified={auction.seller?.isVerifiedSeller}
                  />

                  {/* Coordination Chat */}
                  {chat ? (
                    <div className="mt-6 space-y-4">
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
                      <Link
                        href={`/dashboard/coordination/${id}`}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-xs text-center shadow-md shadow-blue-500/10"
                      >
                        Open Full Coordination Page
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <StartChatButton auctionId={id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary Card (Seller/Winner only) */}
          {auction.status === AuctionStatus.SOLD && (session?.user?.id === auction.winnerId || session?.user?.id === auction.sellerId) && (
            <Card className="border-primary-100 bg-primary-50/30 overflow-hidden">
              <CardHeader className="bg-white/50 py-3 border-b border-primary-100">
                <CardTitle className="text-sm flex items-center gap-2 text-primary-800">
                  <DollarSign className="w-4 h-4" aria-hidden="true" /> {t("financialSummary")}
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
                      <Shield className="w-3 h-3" aria-hidden="true" /> {t("successFee")}
                    </span>
                    <span className="text-[10px] text-slate-400">{t("platformCommission")}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary-700">-{formatBDT(auction.commissionEarned || 0)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Truck className="w-3 h-3" aria-hidden="true" /> {t("deliveryCharge")}
                    </span>
                    <span className="text-[10px] text-slate-400">{t("sellerProtection")}</span>
                  </div>
                   <span className="text-sm font-semibold text-slate-700">{formatBDT(auction.deliveryCharge || 0)}</span>
                </div>

                <div className="p-4 border-t border-primary-100 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary-900 uppercase">{t("netToYou")}</span>
                    <span className="text-xl font-bold text-primary-700">{formatBDT(auction.currentPrice - (auction.commissionEarned || 0))}</span>
                  </div>

                  {/* Second Chance Offer Action */}
                  {session?.user?.id === auction.sellerId && auction.status === AuctionStatus.SOLD && (
                    <SecondChanceOfferButton auctionId={id} />
                  )}
                </div>

                <div className="p-2 bg-blue-50 rounded text-[10px] text-blue-700 flex items-start gap-2">
                  <Info className="w-3 h-3 mt-0.5" aria-hidden="true" />
                  <p>{t("advanceUnlockNote", { amount: formatBDT(auction.currentPrice - (auction.commissionEarned || 0)) })}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center border-t border-gray-50 pt-2">
            <ReportModal auctionId={id} />
          </div>
        </div>
      </div>

      {/* Related Listings Section */}
      {relatedAuctions.length > 0 && (
        <section className="mt-16 pt-12 border-t border-gray-100" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-heading font-bold text-2xl text-gray-900 tracking-tight mb-8">
            People Who Viewed This Item Also Viewed
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {relatedAuctions.map((relatedAuction) => (
              <AuctionCard key={relatedAuction.id} auction={relatedAuction} />
            ))}
          </div>
        </section>
      )}

      {/* Page-level legal footer — meta-content, not bid-panel content */}
      <aside className="mt-12 pt-6 border-t border-gray-100 max-w-3xl mx-auto">
        <p className="text-[11px] text-gray-400 leading-relaxed text-center">
          Nilamit is a marketplace facilitator. By bidding or listing you agree to our{" "}
          <a href="/terms" className="text-gray-500 underline hover:text-primary-600">terms</a>,
          the 18+ eligibility rule, and the binding nature of bids under the ICT Act 2006.
        </p>
      </aside>
    </div>
  );
}
