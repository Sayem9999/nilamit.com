"use client";

import { BadgeCheck, Phone, Mail, FileCheck2 } from "lucide-react";

export interface VerificationState {
  isPhoneVerified?: boolean;
  emailVerified?: Date | string | null;
  isNIDVerified?: boolean;
  isVerifiedSeller?: boolean;
}

/**
 * Compact row of verification badges — shown next to seller names on
 * AuctionCard, seller profile pages, search results, etc.
 *
 * Defaults to a minimal icon-only footprint. Set `variant="pill"` for the
 * labeled version used on profile pages.
 */
export function VerificationBadges({
  state,
  variant = "icon",
  size = "sm",
}: {
  state: VerificationState;
  variant?: "icon" | "pill";
  size?: "xs" | "sm" | "md";
}) {
  const badges = [
    state.isPhoneVerified && {
      label: "Phone verified",
      short: "Phone",
      Icon: Phone,
      tone: "bg-blue-50 text-blue-700 border-blue-100",
      iconTone: "text-blue-600",
    },
    state.emailVerified && {
      label: "Email verified",
      short: "Email",
      Icon: Mail,
      tone: "bg-indigo-50 text-indigo-700 border-indigo-100",
      iconTone: "text-indigo-600",
    },
    state.isNIDVerified && {
      label: "NID verified",
      short: "NID",
      Icon: FileCheck2,
      tone: "bg-green-50 text-green-700 border-green-100",
      iconTone: "text-green-600",
    },
    state.isVerifiedSeller && {
      label: "Verified seller",
      short: "Seller",
      Icon: BadgeCheck,
      tone: "bg-primary-50 text-primary-700 border-primary-100",
      iconTone: "text-primary-600",
    },
  ].filter(Boolean) as Array<{
    label: string;
    short: string;
    Icon: typeof Phone;
    tone: string;
    iconTone: string;
  }>;

  if (badges.length === 0) return null;

  const iconSize = size === "xs" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

  if (variant === "icon") {
    return (
      <span className="inline-flex items-center gap-1" aria-label={badges.map((b) => b.label).join(", ")}>
        {badges.map(({ label, Icon, iconTone }) => (
          <span
            key={label}
            title={label}
            className={`inline-flex items-center ${iconTone}`}
          >
            <Icon className={iconSize} aria-hidden="true" />
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" aria-label={badges.map((b) => b.label).join(", ")}>
      {badges.map(({ label, short, Icon, tone, iconTone }) => (
        <span
          key={label}
          title={label}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${tone}`}
        >
          <Icon className={`${iconSize} ${iconTone}`} aria-hidden="true" />
          {short}
        </span>
      ))}
    </span>
  );
}
