"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, Users, Zap, MapPin, AlertTriangle, ShieldCheck } from "lucide-react";
import { formatBDT } from "@/lib/format";
import { CountdownTimer } from "./CountdownTimer";
import { WatchlistButton } from "./WatchlistButton";
import type { AuctionWithSeller } from "@/types";
import { useSession } from "next-auth/react";
import { useSettings } from "@/context/SettingsContext";
import { useTranslations } from "next-intl";
import TrustBadge from "../social/TrustBadge";

export default function AuctionCard({
  auction,
}: {
  auction: AuctionWithSeller;
}) {
  const { data: session } = useSession();
  const { lightweightMode } = useSettings();
  const t = useTranslations("Auction");
  const mainImage = auction.images[0] || "/placeholder.png";
  const bidCount = auction._count?.bids ?? 0;

  const isWatchlisted =
    auction.watchlist?.some(
      (w: { userId: string }) => w.userId === session?.user?.id,
    ) ?? false;

  return (
    <Link href={`/auctions/${auction.id}`} className="group">
      <div className="bg-white rounded-3xl border border-gray-100/50 shadow-premium hover:shadow-premium-hover transition-all duration-500 overflow-hidden group-hover:-translate-y-2">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
          {lightweightMode ? (
            <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <Zap className="w-8 h-8 text-amber-500 animate-pulse" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                {t("liteModeActive")}
              </span>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <Image
                src={mainImage}
                alt={auction.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          )}
          {/* Status badge */}
          <div className="absolute top-4 left-4 z-10">
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider glass shadow-sm ${
                auction.status === "ACTIVE" ? "text-green-700" : "text-gray-600"
              }`}
            >
              {auction.status === "ACTIVE" ? t("live") : auction.status}
            </span>
          </div>
          {/* Category */}
          <div className="absolute bottom-4 left-4 z-10">
            <span className="glass backdrop-blur-md text-primary-700 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm">
              {auction.category}
            </span>
          </div>
          {/* Watchlist Button */}
          <div className="absolute top-4 right-4 z-10">
            <WatchlistButton
              auctionId={auction.id}
              initialIsWatchlisted={isWatchlisted}
              hoverOnly
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-heading font-bold text-gray-900 text-base sm:text-lg line-clamp-1 group-hover:text-primary-600 transition-colors duration-300">
            {auction.title}
          </h3>

          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-gray-600 truncate">
                {auction.seller.name || t("seller")}
              </span>
              {(auction.seller as { isPhoneVerified?: boolean; emailVerified?: Date | null }).isPhoneVerified || (auction.seller as { isPhoneVerified?: boolean; emailVerified?: Date | null }).emailVerified ? (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/10 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>
            {auction.seller.reputationScore > 0 && (
              <TrustBadge 
                score={auction.seller.reputationScore} 
                size="sm"
                className="scale-95 origin-left"
              />
            )}
            {auction.location && (
              <div className="flex items-center gap-1 text-[11px] text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-medium ml-auto">
                <MapPin className="w-3 h-3" />
                <span className="capitalize">{auction.location}</span>
              </div>
            )}
          </div>

            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-secondary-50 border border-secondary-100/50 rounded-xl">
              <Users className="w-3.5 h-3.5 text-secondary-600" />
              <span className="text-[10px] font-bold text-secondary-700 uppercase tracking-wider">
                {t("circleMemberOnly")}
              </span>
            </div>

          {/* Price & Bid Count */}
          <div className="mt-4 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                {t("currentPrice")}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                <Users className="w-3 h-3" />
                {bidCount} {t("bids")}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="price text-2xl text-gray-900">
                {formatBDT(auction.currentPrice)}
              </span>
              {auction.currentPrice > auction.startingPrice && (
                <span className="text-xs text-gray-400 line-through">
                  {formatBDT(auction.startingPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Service Fee & Net Earnings (Seller Only View) */}
          {session?.user?.id === auction.sellerId && auction.status === "SOLD" && auction.commissionEarned && (
            <div className="mt-4 p-4 bg-primary-50/50 rounded-2xl border border-primary-100/50 space-y-2">
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

          {/* Footer Meta */}
          <div className="mt-4 pt-4 border-t border-gray-100/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 bg-gray-50 py-1.5 px-3 rounded-xl border border-gray-100/50 w-full justify-center group-hover:bg-primary-50 group-hover:border-primary-100/50 transition-colors duration-300">
              <Clock className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
              <CountdownTimer
                endTime={auction.endTime}
                className="text-xs font-bold font-mono tracking-tight"
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
