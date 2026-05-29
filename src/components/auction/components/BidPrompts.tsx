"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { createBidDeposit } from "@/actions/deposit";

interface PromptProps {
  onClose: () => void;
}

export function PhoneVerificationPrompt({ onClose }: PromptProps) {
  const t = useTranslations("BidPanel");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-md p-6 max-w-sm mx-4 shadow-xl">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("verifyPhone")}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{t("verifyPhoneDesc")}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("laterBtn")}
          </button>
          <Link
            href="/profile"
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-primary-700"
          >
            {t("verifyNowBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MFSLinkagePrompt({ onClose }: PromptProps) {
  const t = useTranslations("BidPanel");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-md p-6 max-w-sm mx-4 shadow-xl">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("mfsLinkRequired")}
        </h3>
        <p className="text-sm text-gray-500 mb-2">{t("mfsLinkDesc")}</p>
        
        {/* MFS Brand Micro-Badges */}
        <div className="flex items-center justify-center gap-3 my-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100/60">
          <span className="px-3 py-1 bg-pink-50 border border-pink-100 text-pink-600 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-sm">
            bKash
          </span>
          <span className="px-3 py-1 bg-orange-50 border border-orange-100 text-orange-600 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-sm">
            Nagad
          </span>
          <span className="px-3 py-1 bg-purple-50 border border-purple-100 text-purple-600 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-sm">
            Rocket
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("laterBtn")}
          </button>
          <Link
            href="/profile"
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-primary-700"
          >
            {t("linkMFSNowBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}

interface EliteProps extends PromptProps {
  auctionId: string;
  amount: number;
}

export function EliteBarrierPrompt({ onClose, auctionId, amount }: EliteProps) {
  const t = useTranslations("BidPanel");
  const [isPending, setIsPending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const handleDeposit = async () => {
    setIsPending(true);
    setError(null);
    try {
      const res = await createBidDeposit(auctionId, amount);
      if (res.success) {
        // The deposit is recorded as PENDING — it does NOT grant elite access
        // until an admin verifies the real MFS payment. Reflect that honestly
        // rather than implying the gate is now cleared.
        setSubmitted(true);
        router.refresh();
      } else {
        setError(res.error?.message || "Deposit failed");
      }
    } finally {
      setIsPending(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-md p-6 max-w-sm mx-4 shadow-xl text-center">
          <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">Deposit submitted</h3>
          <p className="text-sm text-gray-500 mb-5">
            Your 1% security deposit (৳{Math.floor(amount * 0.01).toLocaleString()}) is recorded and
            pending verification. Once an admin confirms your payment you&apos;ll be able to place
            elite bids on this auction.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700"
          >
            {t("laterBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-md p-6 max-w-sm mx-4 shadow-xl">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("eliteBarrier")}
        </h3>
        <p className="text-sm text-gray-500 mb-2">{t("eliteDepositDesc")}</p>
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {/* MFS Brand Micro-Badges */}
        <div className="flex items-center justify-center gap-3 my-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100/60">
          <span className="px-3 py-1 bg-pink-50 border border-pink-100 text-pink-600 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-sm">
            bKash
          </span>
          <span className="px-3 py-1 bg-orange-50 border border-orange-100 text-orange-600 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-sm">
            Nagad
          </span>
          <span className="px-3 py-1 bg-purple-50 border border-purple-100 text-purple-600 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-sm">
            Rocket
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("laterBtn")}
          </button>
          <button
            onClick={handleDeposit}
            disabled={isPending}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-primary-700 disabled:opacity-50"
          >
            {isPending ? "..." : t("contactSupportBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

