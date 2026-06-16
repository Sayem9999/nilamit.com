"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Gavel, Clock, Tag, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { SystemConfig } from "@/types";

interface HeroSectionProps {
  systemConfig?: SystemConfig;
  totalUsers?: number;
  /** Whether any auctions are actually ending soon — gates the teaser card so
   *  we never render a "Bid now →" husk pointing at an empty list. */
  hasEndingSoon?: boolean;
}

/** Below this, the member count hurts more than it helps — "13+ members" reads
 *  as a ghost town. Hide the stat until the number is itself a trust signal. */
const MIN_MEMBERS_TO_SHOW = 100;

/**
 * Slim eBay-style promo strip. Replaces the previous full-page hero pitch.
 * Three side-by-side promo cards: Sell-now, Verified-escrow trust, Daily-deals teaser.
 * Total height ~200–240px — leaves the categories grid and product rails to
 * dominate the actual fold, which is how real marketplaces order things.
 */
export function HeroSection({ systemConfig, totalUsers, hasEndingSoon = false }: HeroSectionProps) {
  const t = useTranslations("Home");

  const escrowEnabled = systemConfig?.escrowRequired ?? true;
  // Admin-set heroImage can rot (revoked signed URL, deleted object) — fall
  // back to the bundled asset on load error instead of an empty bordered box.
  const [heroImageError, setHeroImageError] = useState(false);
  const heroImage = (!heroImageError && systemConfig?.heroImage) || "/hero_c2c.png";

  // Admin-editable copy (Admin → Content → Homepage Banner). Fall back to the
  // localized default when an admin hasn't set a custom value, so the promo
  // strip is never blank. Previously these admin fields were ignored entirely
  // and the strip always showed the i18n strings.
  const heroTitle = systemConfig?.heroTitle?.trim() || t("promoSellTitle");
  const heroSubtitle = systemConfig?.heroSubtitle?.trim() || t("promoSellSubtitle");

  const formattedUsers = totalUsers && totalUsers >= MIN_MEMBERS_TO_SHOW
    ? totalUsers >= 1000
      ? `${(totalUsers / 1000).toFixed(1)}k+`
      : `${totalUsers}+`
    : null;

  return (
    <section
      aria-label={t("promoStripLabel")}
      className="bg-gray-50 border-b border-gray-200"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Primary banner — Sell now */}
          <Link
            href="/auctions/create"
            className="md:col-span-7 group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 text-white p-5 sm:p-6 flex items-center gap-4 sm:gap-6 shadow-sm hover:shadow-lg transition-shadow"
          >
            <div className="relative flex-1 min-w-0 z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/15 text-amber-300 backdrop-blur-sm rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide mb-2">
                <Tag className="w-3 h-3" /> {t("promoTagFree")}
              </div>
              <h2 className="font-heading font-bold text-xl sm:text-2xl leading-tight tracking-tight">
                {heroTitle}
              </h2>
              <p className="mt-1 text-primary-100 text-xs sm:text-sm max-w-md">
                {heroSubtitle}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-white group-hover:gap-2 transition-all">
                {t("promoSellCta")} <ArrowRight className="w-4 h-4" />
              </span>
            </div>
            <div className="relative hidden sm:block w-28 h-28 sm:w-32 sm:h-32 shrink-0">
              <Image
                src={heroImage}
                alt=""
                fill
                priority
                sizes="160px"
                className="object-cover rounded-md ring-2 ring-white/20"
                onError={() => setHeroImageError(true)}
              />
            </div>
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          </Link>

          {/* Trust card */}
          <Link
            href="/safety"
            className="md:col-span-3 group bg-white border border-gray-200 hover:border-primary-300 rounded-xl p-4 sm:p-5 flex flex-col justify-center card-elevated"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-md flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-heading font-bold text-sm text-gray-900 leading-tight">
              {escrowEnabled ? t("promoEscrowTitle") : t("promoLocalTitle")}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              {escrowEnabled ? t("promoEscrowSubtitle") : t("promoLocalSubtitle")}
            </p>
            <span className="mt-2 text-[11px] font-bold text-primary-600 group-hover:underline">
              {t("learnMore")} →
            </span>
          </Link>

          {/* Third card: Ending-soon teaser when there IS something ending,
              otherwise a How-it-works card. Never a "Bid now →" husk that
              points at an empty list (Data Purity — CLAUDE.md rule 18). */}
          {hasEndingSoon ? (
            <Link
              href="/auctions?sortBy=endTime&sortOrder=asc"
              className="md:col-span-2 group bg-white border border-gray-200 hover:border-orange-300 rounded-xl p-4 sm:p-5 flex flex-col justify-center card-elevated"
            >
              <div className="w-9 h-9 bg-orange-50 rounded-md flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-heading font-bold text-sm text-gray-900 leading-tight">
                {t("promoEndingTitle")}
              </h3>
              <span className="mt-2 text-[11px] font-bold text-orange-600 group-hover:underline">
                {t("promoEndingCta")} →
              </span>
            </Link>
          ) : (
            <Link
              href="/how-it-works"
              className="md:col-span-2 group bg-white border border-gray-200 hover:border-primary-300 rounded-xl p-4 sm:p-5 flex flex-col justify-center card-elevated"
            >
              <div className="w-9 h-9 bg-blue-50 rounded-md flex items-center justify-center mb-2">
                <HelpCircle className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="font-heading font-bold text-sm text-gray-900 leading-tight">
                {t("promoHowTitle")}
              </h3>
              <span className="mt-2 text-[11px] font-bold text-primary-600 group-hover:underline">
                {t("promoHowCta")} →
              </span>
            </Link>
          )}
        </div>

        {/* Tiny trust strip beneath promo cards */}
        <div className="mt-3 hidden sm:flex items-center justify-center gap-6 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5 text-primary-500" /> {t("trustStripLive")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> {t("trustStripVerified")}
          </span>
          {formattedUsers && (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-bold text-gray-900">{formattedUsers}</span> {t("trustStripMembers")}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
