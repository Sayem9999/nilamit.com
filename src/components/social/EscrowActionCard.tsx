"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payEscrowAdvance, confirmItemReceived } from "@/actions/escrow";
import { raiseDispute } from "@/actions/dispute";
import { ShieldCheck, Clock, CreditCard, AlertTriangle, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatBDT } from "@/lib/format";
import { MockPaymentGateway } from "@/components/payment/MockPaymentGateway";

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
  treasuryNumbers,
}: {
  transaction: EscrowTransaction;
  treasuryNumbers: { bkash: string | null; nagad: string | null };
}) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'bkash' | 'nagad'>('bkash');
  const router = useRouter();
  const t = useTranslations("Escrow");
  const locale = useLocale();

  const user = session?.user as { id: string; bkashNumber?: string; nagadNumber?: string };
  const hasMFS = !!(user?.bkashNumber || user?.nagadNumber);

  const handlePayAdvance = async () => {
    if (!hasMFS) {
      toast.error(t("linkMFSProfile"));
      router.push(`/${locale}/profile`);
      return;
    }
    
    // Choose provider based on what they have linked
    if (user.bkashNumber) setPaymentProvider('bkash');
    else if (user.nagadNumber) setPaymentProvider('nagad');
    
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = async (providerRef: string) => {
    setIsPaymentOpen(false);
    setLoading(true);
    
    try {
      const result = await payEscrowAdvance(transaction.id, providerRef);
      if (result.success) {
        toast.success(t("advanceSuccess"));
        router.refresh();
      } else {
        toast.error(result.error || t("paymentFailed"));
      }
    } catch {
      toast.error(t("paymentFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceived = async () => {
    if (!window.confirm(t("confirmReceivedPrompt"))) return;
    
    setLoading(true);
    const result = await confirmItemReceived(transaction.id);
    if (result.success) {
      toast.success(t("orderComplete"));
      router.refresh();
    } else {
      toast.error(result.error || t("confirmFailed"));
    }
    setLoading(false);
  };

  const isPending = transaction.status === "PENDING";
  const isHeld = transaction.status === "HELD";
  const isReleased = transaction.status === "RELEASED";
  const isDisputed = transaction.status === "DISPUTED";
  const isRefunded = transaction.status === "REFUNDED";

  const handleRaiseDispute = async () => {
    const reason = window.prompt(t("disputePrompt"));
    if (!reason) return;

    setLoading(true);
    const result = await raiseDispute(transaction.id, reason);
    if (result.success) {
      toast.success(t("disputeSubmitted"));
      router.refresh();
    } else {
      toast.error(result.error || t("disputeFailed"));
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
          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bn ${
            isDisputed
              ? "bg-red-100 text-red-700"
              : "bg-slate-200 dark:bg-slate-800 text-slate-600"
          }`}
        >
          {t(`status_${transaction.status}`)}
        </span>
      </CardHeader>

      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-1 bn">
              {transaction.auction.title}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 bn">
              {t("sellerLabel")}: {transaction.auction.seller.name || "N/A"}
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
                  {t("wonDate")}:{" "}
                  {new Date(transaction.auction.endTime).toLocaleDateString(locale === 'bn' ? "bn-BD" : "en-US")}
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
                      {t("linkMFSToPay")}
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
                   {loading ? t("processing") : (!hasMFS ? t("linkMFSBtn") : t("payAdvance"))}
                </Button>
              </div>
            )}

            {isHeld && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 mb-3">
                   <p className="text-xs font-bold flex items-center gap-1.5 mb-1 bn uppercase">
                    <ShieldCheck className="w-3.5 h-3.5" /> {t("paymentSecured")}
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

                  <Button
                    onClick={() => router.push(`/${locale}/dashboard?tab=coordination`)}
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-2 bn border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {t("chatCoordination")}
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
                  {t("orderSuccessNote")}
                </p>
              </div>
            )}

            {isRefunded && (
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-purple-800">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5 bn">
                  {t("refunded")}
                </p>
                 <p className="text-xs bn leading-relaxed">
                  {t("refundSuccessNote")}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <MockPaymentGateway
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
        amount={transaction.amount > 100000 ? 250 : 0} // Logic for advance (Current threshold check)
        provider={paymentProvider}
        merchantNumber={paymentProvider === 'bkash' ? treasuryNumbers.bkash : treasuryNumbers.nagad}
      />
    </Card>
  );
}
