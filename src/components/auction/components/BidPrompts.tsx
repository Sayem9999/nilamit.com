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
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
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
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("mfsLinkRequired")}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{t("mfsLinkDesc")}</p>
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
  const router = useRouter();

  const handleDeposit = async () => {
    setIsPending(true);
    try {
      const res = await createBidDeposit(auctionId, amount);
      if (res.success) {
        // In a real flow, this would be a bKash redirect
        // For now, we simulate success and refresh
        onClose();
        router.refresh();
      } else {
        alert(res.error?.message || "Deposit failed");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
        <h3 className="font-heading font-semibold text-lg text-gray-900 mb-2">
          {t("eliteBarrier")}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{t("eliteDepositDesc")}</p>
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

