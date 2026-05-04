'use client';

import { HydratedEscrowTransaction } from "@/types/finance";
import { EscrowStatus } from "@/types/enums";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payEscrowAdvance, confirmItemReceived } from "@/actions/escrow";
import { ShieldCheck, Clock, CreditCard, AlertTriangle, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatBDT } from "@/lib/format";
import dynamic from "next/dynamic";
const MockPaymentGateway = dynamic(() => import("@/components/payment/MockPaymentGateway").then(mod => mod.MockPaymentGateway), { ssr: false });
import DisputeModal from "./DisputeModal";

import { useSession } from "next-auth/react";

interface EscrowActionCardProps {
  transaction: HydratedEscrowTransaction;
  treasuryNumbers?: {
    bkash: string;
    nagad: string;
  };
}

export function EscrowActionCard({
  transaction,
  treasuryNumbers,
}: EscrowActionCardProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'bkash' | 'nagad'>('bkash');
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
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
        toast.error(result.error?.message || t("paymentFailed"));
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
      toast.error(result.error?.message || t("confirmFailed"));
    }
    setLoading(false);
  };

  const isPending = transaction.status === EscrowStatus.PENDING;
  const isVerifying = transaction.status === EscrowStatus.VERIFICATION_PENDING;
  const isHeld = transaction.status === EscrowStatus.HELD;
  const isReleased = transaction.status === EscrowStatus.RELEASED;
  const isDisputed = transaction.status === EscrowStatus.DISPUTED;
  const isRefunded = transaction.status === EscrowStatus.REFUNDED;

  const handleRaiseDispute = () => {
    setIsDisputeOpen(true);
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
            {isVerifying && "Verification in Progress"}
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

            {/* Logistics Protection Badge */}
            <div className="mt-3 flex items-center gap-2">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bn">Logistics Protected</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium bn italic">Covers RTO shipping up to 120 BDT</span>
            </div>

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
                  {new Date(transaction.auction.endTime).toLocaleDateString("en-US")}
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
                <div className="flex items-start gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  <AlertTriangle className="w-3 h-3 text-slate-400 mt-0.5" />
                  <p className="text-[9px] text-slate-500 leading-tight bn">
                    Rejections without cause (e.g. &quot;change of mind&quot;) will incur a 120 BDT deduction from refund to cover seller&apos;s shipping.
                  </p>
                </div>
              </div>
            )}
            
            {isVerifying && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                  <p className="text-xs font-bold bn uppercase">Awaiting Admin Review</p>
                </div>
                <p className="text-[10px] leading-relaxed bn">
                  Your payment reference is in our verification queue. Once an admin confirms the MFS statement, the auction will proceed to shipment.
                </p>
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
        merchantNumber={(paymentProvider === 'bkash' ? treasuryNumbers?.bkash : treasuryNumbers?.nagad) || ""}
      />

      <DisputeModal 
        transactionId={transaction.id}
        isOpen={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
      />
    </Card>
  );
}
