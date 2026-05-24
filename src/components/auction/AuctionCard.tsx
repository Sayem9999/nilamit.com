"use client";

import Link from "next/link";

import Image from "next/image";
import { Users, Zap, MapPin, Package, Shield, X, RotateCcw, Pencil, Star } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { CountdownTimer } from "./CountdownTimer";
import { WatchlistButton } from "./WatchlistButton";
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

export const AuctionCard = memo(({
  auction,
  priority = false,
  className = "",
}: {
  auction: AuctionWithSeller;
  priority?: boolean;
  className?: string;
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

  const sellerName = auction.seller.name || t("seller");
  const cardLabel = `${auction.title} — ${formatBDT(currentPrice)}, by ${sellerName}, ${bidCount} bid${bidCount === 1 ? "" : "s"}`;

  const isValidImageUrl = (url?: string) => {
    if (!url) return false;
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/") || url.startsWith("data:");
  };

  return (
    <Link href={`/auctions/${auction.id}`} className={`group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-2xl ${className}`} aria-label={cardLabel}>
      <div className="bg-white rounded-2xl border border-gray-100/60 group-hover:border-primary-500/30 shadow-premium hover:shadow-[0_20px_45px_rgba(13,110,253,0.08)] transition-all duration-500 overflow-hidden group-hover:-translate-y-1.5 flex flex-col h-full group-[.featured]:bg-white/5 group-[.featured]:border-white/10 group-[.featured]:shadow-none group-[.featured]:hover:bg-white/10 group-[.featured]:hover:border-white/20">
        {/* Image Area */}
        <div className="relative aspect-[16/10] bg-gray-50 overflow-hidden">
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
                  className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-1.5 p-4 text-center text-slate-300 dark:text-slate-700">
                  <Package className="w-8 h-8 stroke-[1.5]" aria-hidden="true" />
                  <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400/60">{t("noImage")}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 md:top-4 md:left-4 flex flex-col gap-1 md:gap-2 z-10">
            <span className="glass px-1.5 py-0.5 md:px-2.5 md:py-1 rounded md:rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-wider text-primary-700 border border-primary-100/50 shadow-sm flex items-center gap-1 md:gap-1.5 backdrop-blur-md">
              {tCat(auction.category || 'other')}
            </span>
            {auction.condition && (
              <span className="glass px-1.5 py-0.5 md:px-2.5 md:py-1 rounded md:rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-wider text-gray-700 border border-gray-200/50 shadow-sm flex items-center gap-1 md:gap-1.5 backdrop-blur-md">
                <span aria-hidden="true">✨</span> {auction.condition}
              </span>
            )}
            {auction.isFeatured && (
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 text-white px-1.5 py-0.5 md:px-2.5 md:py-1 rounded md:rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md flex items-center gap-1 md:gap-1.5 border border-white/20">
                <Star className="w-2.5 h-2.5 md:w-3 md:h-3 fill-white" aria-hidden="true" /> Featured
              </span>
            )}
            {auction.reservePrice && (auction.isReserveMet === false || auction.currentPrice < (auction.reservePrice || 0)) && (
              <span className="bg-amber-500/90 text-white px-1.5 py-0.5 md:px-2.5 md:py-1 rounded md:rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-md flex items-center gap-1 md:gap-1.5 border border-amber-400/50">
                <Shield className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" /> Reserve not met
              </span>
            )}
          </div>

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

            <WatchlistButton
              auctionId={auction.id}
              initialIsWatchlisted={isWatchlisted}
              className="w-8 h-8 md:w-11 md:h-11 font-bold"
              hoverOnly
            />
          </div>

          {/* Location & Quick Meta */}
          <div className="absolute bottom-2 inset-x-2 md:bottom-4 md:inset-x-4 flex items-center justify-between gap-1.5 md:gap-2 z-10">
            <div className="glass px-1.5 py-1 md:px-2.5 md:py-1.5 rounded-lg md:rounded-xl text-[9px] md:text-[11px] flex items-center gap-1 md:gap-2 backdrop-blur-md border border-white/20 shadow-lg">
              <div className="flex items-center gap-1 md:gap-1.5 text-gray-500 font-bold">
                <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary-500" aria-hidden="true" />
                {auction.location ? tLoc(auction.location) : tLoc("mirpur")}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 md:p-4 flex flex-col flex-1">
          <h3 className="font-heading font-bold text-gray-900 text-xs sm:text-sm md:text-base line-clamp-1 group-hover:text-primary-600 transition-colors duration-300 group-[.featured]:text-white group-[.featured]:group-hover:text-primary-400">
            {auction.title}
          </h3>

          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1 min-w-0">
            {/* Seller chip — uses router.push instead of a nested <Link> so we
                don't produce invalid HTML inside the outer <Link>. */}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/seller/${auction.sellerId}`); }}
              aria-label={`View ${auction.seller.name || t("seller")}'s profile`}
              className="flex items-center gap-1 min-w-0 hover:text-primary-600 transition-colors relative z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
            >
              <span className="text-[10px] md:text-xs font-semibold text-gray-600 truncate group-[.featured]:text-slate-400 group-[.featured]:group-hover:text-primary-400">
                {auction.seller.name || t("seller")}
              </span>
              <VerificationBadge
                emailVerified={auction.seller.emailVerified}
                isVerifiedSeller={!!auction.seller.isVerifiedSeller}
                size="sm"
                showText={false}
                className="scale-90 origin-left"
              />
            </button>
            {(auction.seller.rating ?? 0) > 0 && (
              <TrustBadge
                rating={auction.seller.rating ?? 0}
                ratingCount={auction.seller.ratingCount ?? 0}
                size="sm"
                className="scale-75 md:scale-95 origin-left"
              />
            )}
          </div>

          {/* Price & Bid Count */}
          <div className="mt-2 pt-2 md:mt-3 md:pt-3 border-t border-gray-100/60 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                {displayStatus === "ACTIVE"
                  ? t("currentPrice") 
                  : displayStatus === "SOLD" 
                    ? t("finalPrice") 
                    : displayStatus === "PROCESSING"
                      ? t("auctionEnded") // Or "Processing..."
                      : t("auctionEnded")}
              </span>
              <span className="flex items-center gap-0.5 md:gap-1 text-[8px] md:text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-md">
                <Users className="w-2.5 h-2.5 md:w-3 md:h-3" aria-hidden="true" />
                {bidCount} {t("bids")}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-1 md:gap-2 mt-1">
              <span className="price text-sm sm:text-base md:text-lg lg:text-xl text-gray-900 font-black tracking-tighter group-[.featured]:text-white">
                {formatBDT(currentPrice)}
              </span>
              {auction.currentPrice > auction.startingPrice && (
                <span className="text-[10px] md:text-xs text-gray-400 line-through font-medium">
                  {formatBDT(auction.startingPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Seller Protection View */}
          {session?.user?.id === auction.sellerId && (displayStatus === "SOLD" || displayStatus === "AWAITING_PAYMENT" || displayStatus === "OFFER_PENDING") && auction.commissionEarned && (
            <div className="mt-4 p-4 bg-primary-50/30 rounded-2xl border border-primary-100/50 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{t("finalPrice")}</span>
                <span className="text-gray-900">{formatBDT(auction.currentPrice)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{t("successFee")} ({((auction.commissionEarned / auction.currentPrice) * 100).toFixed(1)}%)</span>
                <span className="text-red-500">- {formatBDT(auction.commissionEarned)}</span>
              </div>
              <div className="pt-2 border-t border-primary-100 flex justify-between items-center mt-2">
                <span className="text-xs font-black text-primary-900 uppercase">{t("netToYou")}</span>
                <span className="text-lg font-black text-primary-700">{formatBDT(auction.currentPrice - (auction.commissionEarned || 0))}</span>
              </div>
            </div>
          )}

          {/* Footer Timer */}
          <div className="mt-auto pt-2 md:pt-3 flex items-center justify-between">
            <CountdownTimer
              endTime={auction.endTime}
              variant="card-footer"
              className="py-1.5 px-2 text-[10px] md:py-2 md:px-3 md:text-xs rounded-xl md:rounded-2xl"
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
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
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
