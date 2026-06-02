"use client";

import Link from "next/link";

import Image from "next/image";
import { 
  Users, Zap, MapPin, Package, X, RotateCcw, Pencil, Star,
  Smartphone, Tv, Car, Shirt, Home, Dumbbell, BookOpen, Gem, Wrench, Sparkles, RefreshCw,
  Laptop, Camera, Watch, Gamepad, Plug
} from "lucide-react";
import { formatBDT } from "@/lib/format";
import { CountdownTimer } from "./CountdownTimer";
import { WatchlistButton } from "./WatchlistButton";
import { ShareButton } from "./ShareButton";
import { EditListingModal } from "./EditListingModal";
import type { AuctionWithSeller } from "@/types";
import { useSession } from "next-auth/react";
import { useSettings } from "@/context/SettingsContext";
import { useTranslations } from "next-intl";
import TrustBadge from "../social/TrustBadge";
import VerificationBadge from "../social/VerificationBadge";
import { useRouter } from "next/navigation";
import { cancelAuction, relistAuction } from "@/actions/auction";
import { toggleFeaturedAuction } from "@/actions/admin-content";
import toast from "react-hot-toast";
import { useAuctionPrice } from "@/hooks/useAuctionPrice";

import React, { memo, useState, useTransition } from "react";

// Premium dynamic styling and Lucide icons for categories
const getCategoryBadgeStyles = (cat?: string) => {
  const normalized = (cat || 'other').toLowerCase().replace(/_/g, '-');
  const className = "bg-slate-100/70 text-slate-600 dark:text-slate-300 border-slate-200/60 rounded px-2 py-0.5 text-[9px] font-bold flex items-center gap-1 border uppercase tracking-wider";
  switch (normalized) {
    case 'mobile-phones': return { className, icon: Smartphone };
    case 'computers-laptops': return { className, icon: Laptop };
    case 'electronics': return { className, icon: Tv };
    case 'cameras-optics': return { className, icon: Camera };
    case 'watches-jewelry': return { className, icon: Watch };
    case 'vehicles': return { className, icon: Car };
    case 'fashion': return { className, icon: Shirt };
    case 'home-garden': return { className, icon: Home };
    case 'home-appliances': return { className, icon: Plug };
    case 'sports': return { className, icon: Dumbbell };
    case 'hobbies-music': return { className, icon: Gamepad };
    case 'books': return { className, icon: BookOpen };
    case 'collectibles': return { className, icon: Gem };
    default: return { className, icon: Package };
  }
};

const getConditionBadgeStyles = (cond?: string) => {
  const normalized = (cond || '').toUpperCase();
  switch (normalized) {
    case 'NEW':
      return {
        className: "bg-emerald-50 text-emerald-700 dark:text-emerald-350 border-emerald-200/60 rounded px-2 py-0.5 text-[9px] font-bold flex items-center gap-1 border uppercase tracking-wider",
        icon: Sparkles
      };
    case 'USED':
      return {
        className: "bg-slate-50 text-slate-700 dark:text-slate-350 border-slate-200/60 rounded px-2 py-0.5 text-[9px] font-bold flex items-center gap-1 border uppercase tracking-wider",
        icon: RefreshCw
      };
    case 'REFURBISHED':
      return {
        className: "bg-blue-50 text-blue-700 dark:text-blue-350 border-blue-200/60 rounded px-2 py-0.5 text-[9px] font-bold flex items-center gap-1 border uppercase tracking-wider",
        icon: Wrench
      };
    default:
      return null;
  }
};

export const AuctionCard = memo(({
  auction,
  priority = false,
  className = "",
  viewMode = "grid",
}: {
  auction: AuctionWithSeller;
  priority?: boolean;
  className?: string;
  viewMode?: "grid" | "list";
}) => {
  const { data: session } = useSession();
  const { lightweightMode } = useSettings();
  const t = useTranslations("Auction");
  const tCat = useTranslations("Categories");
  const tLoc = useTranslations("Locations");
  const tOwner = useTranslations("Owner");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const cardBidCount = auction._count?.bids ?? auction.bidCount ?? 0;
  const { currentPrice, bidCount, status } = useAuctionPrice(auction.id, auction.currentPrice, cardBidCount, auction.status);

  const now = new Date();
  const endTime = new Date(auction.endTime);
  const isTimeEnded = now >= endTime;

  // Use real-time status, but if time is ended and status is still ACTIVE,
  // we treat it as 'PROCESSING' for UI purposes.
  const displayStatus = (status === "ACTIVE" && isTimeEnded) ? "PROCESSING" : status;

  const isOwner = !!session?.user?.id && session.user.id === auction.sellerId;
  const isAdmin = !!(session?.user as { isAdmin?: boolean })?.isAdmin;
  const canCancel = isOwner && displayStatus === "ACTIVE" && bidCount === 0;
  const canEdit   = isOwner && displayStatus === "ACTIVE" && bidCount === 0;
  const canRelist = isOwner && (displayStatus === "EXPIRED" || displayStatus === "CANCELLED");

  const [isFeatured, setIsFeatured] = useState(!!auction.isFeatured);
  const [imageError, setImageError] = useState(false);

  const handleCancel = () => {
    setShowCancelConfirm(false);
    startTransition(async () => {
      const res = await cancelAuction(auction.id);
      if (res.success) {
        toast.success(tOwner("listingCancelled"));
        router.refresh();
      } else {
        toast.error(res.error?.message ?? tOwner("cancelFailed"));
      }
    });
  };

  const handleRelist = () => {
    startTransition(async () => {
      const res = await relistAuction(auction.id);
      if (res.success && res.data) {
        toast.success(tOwner("relistedSuccess"));
        router.push(`/auctions/${res.data.auctionId}`);
      } else {
        toast.error(res.error?.message ?? tOwner("relistFailed"));
      }
    });
  };

  const handleToggleFeatured = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !isFeatured;
    setIsFeatured(newState);
    startTransition(async () => {
      const res = await toggleFeaturedAuction(auction.id, newState);
      if (res.success) {
        toast.success(newState ? "Auction featured" : "Auction unfeatured");
      } else {
        setIsFeatured(!newState);
        toast.error("Failed to update featured status");
      }
    });
  };

  const isWatchlisted =
    auction.watchlist?.some(
      (w: { userId: string }) => w.userId === session?.user?.id,
    ) ?? false;

  // Defensive: a deleted / unhydrated seller (toSellerPublic returns null for a
  // missing user doc, and AuctionReader asserts it non-null) must never crash
  // the card render. This was the "Something went wrong" page when an auction
  // with a missing seller doc was featured. Fall back to a safe shell.
  const seller = auction.seller ?? ({
    id: auction.sellerId, name: null, image: null, rating: 0, ratingCount: 0,
    emailVerified: null, isVerifiedSeller: false,
  } as AuctionWithSeller["seller"]);

  const sellerName = seller.name || t("seller");
  const cardLabel = `${auction.title} — ${formatBDT(currentPrice)}, by ${sellerName}, ${bidCount} bid${bidCount === 1 ? "" : "s"}`;

  const isValidImageUrl = (url?: string) => {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/") || url.startsWith("data:");
  };

  // CLASSIC HORIZONTAL EBAY LIST LAYOUT
  if (viewMode === "list") {
    return (
      <Link href={`/auctions/${auction.id}`} className={`group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-md ${className}`} aria-label={cardLabel}>
        <div className="bg-white rounded-md border border-gray-200 group-hover:border-primary-400 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col sm:flex-row h-full">
          {/* Image Area */}
          <div className="relative w-full sm:w-56 aspect-[16/10] sm:aspect-[4/3] bg-gray-50 overflow-hidden flex-shrink-0">
            {lightweightMode ? (
              <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-1 p-4 text-center">
                <Zap className="w-6 h-6 text-amber-500" aria-hidden="true" />
              </div>
            ) : (
              <div className="relative w-full h-full">
                {auction.images?.[0] && isValidImageUrl(auction.images[0]) && !imageError ? (
                  <Image
                    src={auction.images[0].includes('alt=media') ? auction.images[0].replace(/(\.[\w\d_-]+)(\?alt=media.*)?$/i, '_200x200$1$2') : auction.images[0]}
                    alt={`${auction.title} — auction listing photo`}
                    fill
                    priority={priority}
                    sizes="(max-width: 768px) 50vw, 200px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 text-center text-slate-350">
                    <Package className="w-8 h-8 stroke-[1.5]" aria-hidden="true" />
                  </div>
                )}
              </div>
            )}

            {/* Floating Admin & Watchlist button overlays */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleToggleFeatured}
                  disabled={isPending}
                  className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center border transition-all ${
                    isFeatured ? "bg-amber-500 text-white border-amber-400" : "bg-white/20 text-white/70 border-white/15"
                  }`}
                >
                  <Star className={`w-3 h-3 ${isFeatured ? "fill-white" : ""}`} />
                </button>
              )}
              <ShareButton
                compact
                title={auction.title}
                auctionId={auction.id}
                price={currentPrice}
                className="w-7 h-7"
              />
              <WatchlistButton
                auctionId={auction.id}
                initialIsWatchlisted={isWatchlisted}
                className="w-7 h-7"
                hoverOnly
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 flex flex-col flex-1 min-w-0">
            <div className="flex-1 space-y-2">
              <h3 className="font-heading font-bold text-gray-900 text-sm sm:text-base md:text-lg line-clamp-1 group-hover:text-primary-600 transition-colors duration-300">
                {auction.title}
              </h3>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const styles = getCategoryBadgeStyles(auction.category);
                  const CatIcon = styles.icon;
                  return (
                    <span className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 backdrop-blur-md rounded-full px-2 py-0.5 text-[9px] font-extrabold flex items-center gap-1 border uppercase tracking-wider">
                      <CatIcon className="w-2.5 h-2.5" />
                      {tCat(auction.category || 'other')}
                    </span>
                  );
                })()}
                {auction.condition && (() => {
                  const styles = getConditionBadgeStyles(auction.condition);
                  if (!styles) return null;
                  const CondIcon = styles.icon;
                  return (
                    <span className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 backdrop-blur-md rounded-full px-2 py-0.5 text-[9px] font-extrabold flex items-center gap-1 border uppercase tracking-wider">
                      <CondIcon className="w-2.5 h-2.5" />
                      {auction.condition}
                    </span>
                  );
                })()}
              </div>

              {/* Seller details & Locations */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/seller/${auction.sellerId}`); }}
                  className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                >
                  <span className="font-semibold text-gray-500 truncate">
                    {seller.name || t("seller")}
                  </span>
                  <VerificationBadge
                    emailVerified={seller.emailVerified}
                    isVerifiedSeller={!!seller.isVerifiedSeller}
                    size="sm"
                    showText={false}
                  />
                </button>

                <span className="text-gray-400 font-bold flex items-center gap-1 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-[10px]">
                  <MapPin className="w-3 h-3 text-primary-500" />
                  {auction.location ? tLoc(auction.location) : tLoc("mirpur")}
                </span>
              </div>
            </div>

            {/* Bottom pricing section */}
            <div className="mt-4 pt-3 border-t border-gray-100/60 flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide block leading-none">
                  {t("currentPrice")}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                    {formatBDT(currentPrice)}
                  </span>
                  {auction.currentPrice > auction.startingPrice && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatBDT(auction.startingPrice)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0">
                  <Users className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{bidCount} {bidCount === 1 ? t("bid") : t("bids")}</span>
                </div>
                <CountdownTimer
                  endTime={auction.endTime}
                  variant="card-footer"
                  className="py-1 px-2.5 text-xs rounded-lg whitespace-nowrap flex-shrink-0 w-auto h-auto font-sans"
                />
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/auctions/${auction.id}`} className={`group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-md ${className}`} aria-label={cardLabel}>
      <div className="bg-white rounded-md border border-gray-200 group-hover:border-primary-400 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
        {/* Image Area */}
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          {lightweightMode ? (
            <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <Zap className="w-8 h-8 text-amber-500 animate-pulse" aria-hidden="true" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {t("liteModeActive")}
              </span>
            </div>
          ) : (
            <div className="relative w-full h-full">
              {auction.images?.[0] && isValidImageUrl(auction.images[0]) && !imageError ? (
                <Image
                  src={auction.images[0].includes('alt=media') ? auction.images[0].replace(/(\.[\w\d_-]+)(\?alt=media.*)?$/i, '_200x200$1$2') : auction.images[0]}
                  alt={`${auction.title} — auction listing photo`}
                  fill
                  priority={priority}
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-1.5 p-4 text-center text-slate-300 dark:text-slate-700">
                  <Package className="w-8 h-8 stroke-[1.5]" aria-hidden="true" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400/60">{t("noImage")}</span>
                </div>
              )}
            </div>
          )}

          {/* Badges moved to content area below */}

          {/* Action Buttons (Watchlist & Admin Feature) */}
          <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10 flex items-center gap-1 md:gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={handleToggleFeatured}
                disabled={isPending}
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${
                  isFeatured 
                    ? "bg-amber-500 text-white border-amber-400 shadow-lg scale-110 animate-in zoom-in duration-300" 
                    : "bg-white/10 text-white/60 border-white/20 hover:bg-white/20 hover:scale-105"
                }`}
                aria-label={isFeatured ? "Unfeature auction" : "Feature auction"}
              >
                <Star className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isFeatured ? "fill-white" : ""}`} />
              </button>
            )}

            <ShareButton
              compact
              title={auction.title}
              auctionId={auction.id}
              price={currentPrice}
              className="w-8 h-8 md:w-11 md:h-11"
            />
            <WatchlistButton
              auctionId={auction.id}
              initialIsWatchlisted={isWatchlisted}
              className="w-8 h-8 md:w-11 md:h-11 font-bold"
              hoverOnly
            />
          </div>

          {/* Location pill (bottom-left of image) */}
          <div className="absolute bottom-2 left-2 z-10">
            <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] flex items-center gap-1 border border-white/40 shadow-sm">
              <div className="flex items-center gap-1 text-gray-700 font-semibold">
                <MapPin className="w-2.5 h-2.5 text-primary-500" aria-hidden="true" />
                {auction.location ? tLoc(auction.location) : tLoc("mirpur")}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col flex-1">
          <h3 className="font-heading font-semibold text-gray-900 text-[13px] sm:text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-primary-600 transition-colors leading-tight">
            {auction.title}
          </h3>

          <div className="flex flex-wrap items-center gap-1 mt-1.5 min-w-0">
            {/* Badges moved here for cleaner UI */}
            {(() => {
              const styles = getCategoryBadgeStyles(auction.category);
              const CatIcon = styles.icon;
              return (
                <span className={styles.className}>
                  <CatIcon className="w-2.5 h-2.5" aria-hidden="true" />
                  {tCat(auction.category || 'other')}
                </span>
              );
            })()}

            {auction.condition && (() => {
              const styles = getConditionBadgeStyles(auction.condition);
              if (!styles) return null;
              const CondIcon = styles.icon;
              return (
                <span className={styles.className}>
                  <CondIcon className="w-2.5 h-2.5" aria-hidden="true" />
                  {auction.condition}
                </span>
              );
            })()}

            {auction.isFeatured && (
              <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-white text-white" aria-hidden="true" />
                Featured
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1.5 min-w-0">
            {/* Seller chip — uses router.push instead of a nested <Link> so we
                don't produce invalid HTML inside the outer <Link>. */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/seller/${auction.sellerId}`); }}
              aria-label={`View ${seller.name || t("seller")}'s profile`}
              className="flex items-center gap-1 min-w-0 hover:text-primary-600 transition-colors relative z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
            >
              <span className="text-[11px] font-medium text-gray-500 truncate">
                {seller.name || t("seller")}
              </span>
              <VerificationBadge
                emailVerified={seller.emailVerified}
                isVerifiedSeller={!!seller.isVerifiedSeller}
                size="sm"
                showText={false}
                className="scale-90 origin-left"
              />
            </button>
            {(seller.rating ?? 0) > 0 && (
              <TrustBadge
                rating={seller.rating ?? 0}
                ratingCount={seller.ratingCount ?? 0}
                size="sm"
                className="scale-75 md:scale-95 origin-left"
              />
            )}
          </div>

          {/* Price & Bid Count */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide leading-none">
                {displayStatus === "ACTIVE"
                  ? t("currentPrice")
                  : displayStatus === "SOLD"
                    ? t("finalPrice")
                    : t("auctionEnded")}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
                <Users className="w-2.5 h-2.5" aria-hidden="true" />
                {bidCount} {bidCount === 1 ? t("bid") : t("bids")}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5 mt-1">
              <span className="price text-lg sm:text-xl text-gray-900 font-extrabold tracking-tight">
                {formatBDT(currentPrice)}
              </span>
              {auction.currentPrice > auction.startingPrice && (
                <span className="text-[11px] text-gray-400 line-through font-medium">
                  {formatBDT(auction.startingPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Seller Protection View */}
          {session?.user?.id === auction.sellerId && (displayStatus === "SOLD" || displayStatus === "AWAITING_PAYMENT" || displayStatus === "OFFER_PENDING") && auction.commissionEarned && (
            <div className="mt-4 p-4 bg-primary-50/30 rounded-md border border-primary-100/50 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{t("finalPrice")}</span>
                <span className="text-gray-900">{formatBDT(auction.currentPrice)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{t("successFee")} ({((auction.commissionEarned / auction.currentPrice) * 100).toFixed(1)}%)</span>
                <span className="text-red-500">- {formatBDT(auction.commissionEarned)}</span>
              </div>
              <div className="pt-2 border-t border-primary-100 flex justify-between items-center mt-2">
                <span className="text-xs font-bold text-primary-900 uppercase">{t("netToYou")}</span>
                <span className="text-lg font-bold text-primary-700">{formatBDT(auction.currentPrice - (auction.commissionEarned || 0))}</span>
              </div>
            </div>
          )}

          {/* Footer Timer */}
          <div className="mt-auto pt-2 flex items-center justify-between">
            <CountdownTimer
              endTime={auction.endTime}
              variant="card-footer"
              className="py-1 px-2 text-[10px] rounded"
            />
          </div>

          {/* Owner controls — only visible to the seller on their own listings.
              Buttons stop the parent <Link> from navigating to the auction page. */}
          {(canCancel || canEdit || canRelist) && (
            <div className="mt-3 flex gap-2 relative z-20">
              {canEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowEditModal(true); }}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                >
                  <Pencil className="w-3.5 h-3.5" /> {tOwner("edit")}
                </button>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCancelConfirm(true); }}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> {tOwner("cancel")}
                </button>
              )}
              {canRelist && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRelist(); }}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-primary-200 text-primary-600 hover:bg-primary-50 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {isPending ? tOwner("relisting") : tOwner("relist")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div onClick={(e) => { if (showEditModal) { e.preventDefault(); e.stopPropagation(); } }}>
        <EditListingModal
          auctionId={auction.id}
          initialDescription={auction.description ?? ""}
          initialImages={auction.images ?? []}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSaved={() => router.refresh()}
        />
      </div>

      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCancelConfirm(false); }}
        >
          <div
            className="bg-white rounded-md shadow-md max-w-md w-full p-6"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <h2 className="text-lg font-heading font-bold text-gray-900 mb-1">{tOwner("cancelTitle")}</h2>
            <p className="text-sm text-gray-600 mb-2">{tOwner("cancelDescription")}</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCancelConfirm(false); }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50"
              >
                {tOwner("keepListing")}
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancel(); }}
                disabled={isPending}
                className="px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? tOwner("cancelling") : tOwner("confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Link>
  );
});

AuctionCard.displayName = "AuctionCard";
export default AuctionCard;
