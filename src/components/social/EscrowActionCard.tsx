"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payEscrowAdvance, confirmItemReceived } from "@/actions/escrow";
import { raiseDispute } from "@/actions/dispute";
import { ShieldCheck, Clock, CreditCard, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatBDT } from "@/lib/format";

import { useSession } from "next-auth/react";

interface EscrowTransaction {
  id: string;
  status: string;
  amount: number;
  auction: {
    title: string;
    seller: { name: string | null };
    endTime: string | Date;
  };
  dispute?: { reason: string } | null;
}

export function EscrowActionCard({
  transaction,
}: {
  transaction: EscrowTransaction;
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("Escrow");

  const user = session?.user as { id: string; bkashNumber?: string; nagadNumber?: string };
  const hasMFS = !!(user?.bkashNumber || user?.nagadNumber);

  const handlePayAdvance = async () => {
    if (!hasMFS) {
      toast.error("অনুগ্রহ করে প্রোফাইল থেকে বিকাশ বা নগদ অ্যাকাউন্ট লিঙ্ক করুন।");
      router.push("/profile");
      return;
    }
    setLoading(true);
    const result = await payEscrowAdvance(transaction.id);
    if (result.success) {
      toast.success(
        "অ্যাডভান্স পেমেন্ট সফল হয়েছে! এখন বিক্রেতার তথ্য দেখতে পাবেন।",
      );
      router.refresh();
    } else {
      toast.error(result.error || "পেমেন্ট প্রসেস করতে ব্যর্থ হয়েছে।");
    }
    setLoading(false);
  };

  const handleConfirmReceived = async () => {
    if (!window.confirm("Are you sure you have received the item in good condition? This will release the final funds.")) return;
    
    setLoading(true);
    const result = await confirmItemReceived(transaction.id);
    if (result.success) {
      toast.success(
        "লেনদেন সফলভাবে সম্পন্ন হয়েছে!",
      );
      router.refresh();
    } else {
      toast.error(result.error || "কনফার্ম করতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  const isPending = transaction.status === "PENDING";
  const isHeld = transaction.status === "HELD";
  const isReleased = transaction.status === "RELEASED";
  const isDisputed = transaction.status === "DISPUTED";
  const isRefunded = transaction.status === "REFUNDED";

  const handleRaiseDispute = async () => {
    const reason = window.prompt("Please enter the reason for your dispute:");
    if (!reason) return;

    setLoading(true);
    const result = await raiseDispute(transaction.id, reason);
    if (result.success) {
      toast.success("অভিযোগ জমা হয়েছে। মডারেটর রিভিউ না করা পর্যন্ত পেমেন্ট স্থগিত থাকবে।");
      router.refresh();
    } else {
      toast.error(result.error || "অভিযোগ জমা দিতে ব্যর্থ হয়েছে।");
    }
    setLoading(false);
  };

  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 py-4 flex flex-row items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className={`w-5 h-5 ${isReleased ? "text-emerald-500" : "text-amber-500"}`}
          />
          <CardTitle className="text-base bn">
            {isReleased && t("fundsReleased")}
            {isHeld && t("paymentSecured")}
            {isPending && t("awaitingPayment")}
            {isDisputed && t("underDispute")}
            {isRefunded && t("refunded")}
          </CardTitle>
        </div>
        <span
          className={`font-mono text-sm uppercase px-2 py-0.5 rounded ${
            isDisputed
              ? "bg-red-100 text-red-700"
              : "bg-slate-200 dark:bg-slate-800"
          }`}
        >
          {transaction.status}
        </span>
      </CardHeader>

      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-1 bn">
              {transaction.auction.title}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 bn">
              বিক্রেতা: {transaction.auction.seller.name || "অজ্ঞাত"}
            </p>

            <div className="mt-4 flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatBDT(transaction.amount)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span className="bn">
                  নিলাম জেতার তারিখ:{" "}
                  {new Date(transaction.auction.endTime).toLocaleDateString("bn-BD")}
                </span>
              </div>
            </div>
          </div>

          <div className="md:w-64 flex-shrink-0">
            {isPending && (
              <div className="space-y-3">
                {!hasMFS && (
                   <div className="p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-700 bn">
                     <AlertTriangle className="w-3 h-3 inline mr-1" />
                     পেমেন্ট করতে প্রথমে বিকাশ বা নগদ লিঙ্ক করুন।
                   </div>
                )}
                <p className="text-xs text-slate-500 hidden md:block bn leading-relaxed">
                  {t("gatedInfoNote")}
                </p>
                <Button
                  onClick={handlePayAdvance}
                  disabled={loading}
                  className={`w-full bn py-5 ${!hasMFS ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"} text-white`}
                >
                  {loading ? t("processing") : (!hasMFS ? "Link MFS to Pay" : t("payAdvance"))}
                </Button>
              </div>
            )}

            {isHeld && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 mb-3">
                  <p className="text-xs font-bold flex items-center gap-1.5 mb-1 bn uppercase">
                    <ShieldCheck className="w-3.5 h-3.5" /> পেমেন্ট সুরক্ষিত
                  </p>
                  <p className="text-[11px] opacity-90 leading-snug bn">
                    {t("holdNote")}
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleConfirmReceived}
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 bn py-5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {loading ? t("processing") : t("confirmReceived")}
                  </Button>

                  <Button
                    onClick={handleRaiseDispute}
                    disabled={loading}
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center justify-center gap-2 bn"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {t("raiseDispute")}
                  </Button>
                </div>
              </div>
            )}

            {isDisputed && (
              <div className="p-4 bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900 rounded-lg text-red-800 dark:text-red-300">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5 bn">
                  <AlertTriangle className="w-4 h-4" /> {t("underDispute")}
                </p>
                <p className="text-xs bn leading-relaxed">
                  {t("disputeNote")}
                </p>
                {transaction.dispute?.reason && (
                  <div className="mt-2 pt-2 border-t border-red-200 text-[11px] italic bn">
                    &quot;{transaction.dispute.reason}&quot;
                  </div>
                )}
              </div>
            )}

            {isReleased && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-lg text-emerald-800 dark:text-emerald-300">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5 bn">
                  <ShieldCheck className="w-4 h-4" /> {t("fundsReleased")}
                </p>
                <p className="text-xs bn leading-relaxed">
                  লেনদেনটি সফলভাবে সম্পন্ন হয়েছে। বিক্রেতা তার পেমেন্ট পেয়েছেন।
                </p>
              </div>
            )}

            {isRefunded && (
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-purple-800">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5 bn">
                  {t("refunded")}
                </p>
                <p className="text-xs bn leading-relaxed">
                  বিরোধের মীমাংসা আপনার পক্ষে হয়েছে এবং পেমেন্ট ফেরত দেওয়া হয়েছে।
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
