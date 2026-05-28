'use client';

import { HydratedEscrowTransaction } from "@/types/finance";
import { EscrowStatus } from "@/types/enums";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payEscrowAdvance, confirmItemReceived } from "@/actions/escrow";
import { ShieldCheck, Clock, CreditCard, AlertTriangle, MessageSquare, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatBDT } from "@/lib/format";
import dynamic from "next/dynamic";
const MockPaymentGateway = dynamic(() => import("@/components/payment/MockPaymentGateway").then(mod => mod.MockPaymentGateway), { ssr: false });
import DisputeModal from "./DisputeModal";
import { cn } from "@/lib/utils";

import { useSession } from "next-auth/react";

interface EscrowActionCardProps {
  transaction: HydratedEscrowTransaction;
  treasuryNumbers?: {
    bkash: string;
    nagad: string;
  };
  layout?: "horizontal" | "vertical";
}

export function EscrowActionCard({
  transaction,
  treasuryNumbers,
  layout,
}: EscrowActionCardProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'bkash' | 'nagad'>('bkash');
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("Escrow");
  const _locale = useLocale();

  const user = session?.user as { id: string; bkashNumber?: string; nagadNumber?: string };
  const hasMFS = !!(user?.bkashNumber || user?.nagadNumber);

  const handlePayAdvance = async () => {
    if (!hasMFS) {
      toast.error(t("linkMFSProfile"));
      router.push("/profile");
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
        const msg = result.error?.message ?? "";
        if (msg.includes("ADDRESS_REQUIRED")) {
          toast.error(t("addressRequired"), { duration: 6000 });
          router.push("/profile");
        } else if (msg.includes("SELLER_ADDRESS_MISSING")) {
          toast.error(t("sellerAddressMissing"), { duration: 6000 });
        } else if (msg.includes("MFS_LINKAGE_REQUIRED")) {
          toast.error(t("linkMFSProfile"), { duration: 6000 });
          router.push("/profile");
        } else {
          toast.error(msg || t("paymentFailed"));
        }
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

  let activeStep = 0;
  if (isPending) activeStep = 0;
  else if (isVerifying) activeStep = 1;
  else if (isHeld || isDisputed) activeStep = 2;
  else if (isReleased || isRefunded) activeStep = 3;

  const steps = [
    {
      title: t("status_PENDING"),
      description: t("awaitingPayment"),
      icon: CreditCard,
    },
    {
      title: t("status_VERIFICATION_PENDING"),
      description: t("verificationInProgress"),
      icon: Clock,
    },
    {
      title: isDisputed ? t("status_DISPUTED") : t("status_HELD"),
      description: isDisputed ? t("underDispute") : t("paymentSecured"),
      icon: isDisputed ? AlertTriangle : ShieldCheck,
    },
    {
      title: t("status_RELEASED"),
      description: t("fundsReleased"),
      icon: Check,
    },
  ];

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
            {isVerifying && t("verificationInProgress")}
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
        {/* Visual Escrow Progress Tracker */}
        <div className="relative mb-8 p-6 bg-slate-50/50 dark:bg-slate-900/10 rounded-md border border-slate-100 dark:border-slate-800/80">
          {/* Desktop connecting progress lines */}
          <div className={cn(
            "absolute top-[44px] left-[52px] right-[52px] h-[2px] bg-slate-200 dark:bg-slate-800 -z-10",
            layout === 'vertical' ? "hidden" : "hidden md:block"
          )}>
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-primary-600 transition-all duration-500 ease-in-out" 
              style={{ width: `${activeStep === 0 ? 0 : activeStep === 1 ? 33.33 : activeStep === 2 ? 66.66 : 100}%` }}
            />
          </div>

          {/* Mobile connecting progress lines */}
          <div className={cn(
            "absolute left-[44px] top-[44px] bottom-[44px] w-[2px] bg-slate-200 dark:bg-slate-800 -z-10",
            layout === 'vertical' ? "block" : "md:hidden"
          )}>
            <div 
              className="w-full bg-gradient-to-b from-emerald-500 to-primary-600 transition-all duration-500 ease-in-out" 
              style={{ height: `${activeStep === 0 ? 0 : activeStep === 1 ? 33.33 : activeStep === 2 ? 66.66 : 100}%` }}
            />
          </div>

          <div className={cn(
            "flex flex-col justify-between gap-6",
            layout !== 'vertical' && "md:flex-row md:gap-0"
          )}>
            {steps.map((step, index) => {
              const isCompleted = index < activeStep;
              const isActive = index === activeStep;
              const Icon = step.icon;

              let circleStyles = "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700";
              let textStyles = "text-slate-400 dark:text-slate-500";
              let shadowStyles = "";

              if (isCompleted) {
                circleStyles = "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-400";
                textStyles = "text-emerald-600 dark:text-emerald-400 font-semibold";
              } else if (isActive) {
                if (isDisputed && index === 2) {
                  circleStyles = "bg-gradient-to-br from-red-500 to-rose-600 text-white border-red-400 animate-pulse";
                  textStyles = "text-red-600 dark:text-red-400 font-bold";
                  shadowStyles = "ring-4 ring-red-100 dark:ring-red-950/50 shadow-[0_0_15px_rgba(239,68,68,0.5)]";
                } else {
                  circleStyles = "bg-gradient-to-br from-primary-500 to-primary-700 text-white border-primary-400";
                  textStyles = "text-primary font-bold";
                  shadowStyles = "ring-4 ring-blue-50 dark:ring-blue-950/50 shadow-[0_0_15px_rgba(37,99,235,0.4)]";
                }
              }

              return (
                <div key={index} className={cn(
                  "flex items-center flex-1 text-left z-10 gap-4",
                  layout !== 'vertical' && "md:flex-col md:text-center md:gap-2"
                )}>
                  {/* Step Circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ease-in-out ${circleStyles} ${shadowStyles}`}>
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive && !isDisputed ? "animate-pulse" : ""}`} />
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="flex flex-col">
                    <span className={`text-xs md:text-sm transition-colors duration-300 ${textStyles}`}>
                      {step.title}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {step.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn(
          "flex flex-col justify-between gap-6",
          layout !== 'vertical' && "md:flex-row md:items-center"
        )}>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-1 bn truncate">
              {transaction.auction.title}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 bn">
              {t("sellerLabel")}: {transaction.auction.seller.name || "N/A"}
            </p>

            {/* Logistics Protection Badge */}
            <div className={cn(
              "mt-3 flex gap-2",
              layout === 'vertical' ? "flex-col items-start gap-1.5" : "items-center"
            )}>
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 px-2.5 py-1 rounded-lg flex items-center gap-1.5 flex-shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide bn">{t("logisticsProtected")}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium bn italic">{t("logisticsProtectedDesc")}</span>
            </div>

            {/* Payment Split Breakdown */}
            <div className="mt-5 bg-slate-50/70 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800/80 rounded-md p-4 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>{t("advanceDeposit")}</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{formatBDT(transaction.amount)}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100/50 dark:border-slate-800/50">
                {t("advanceDescription")}
              </p>

              {(transaction.codAmount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-dashed border-slate-200 dark:border-slate-800 pt-3">
                    <span>{t("cashOnDelivery")}</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{formatBDT(transaction.codAmount!)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100/50 dark:border-slate-800/50">
                    {t("codDescription", { amount: formatBDT(transaction.codAmount!) })}
                  </p>
                </>
              )}

              <div className="flex justify-between items-center text-sm font-bold text-slate-800 dark:text-slate-200 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary-500" />
                  {t("totalDealValue")}
                </span>
                <span className="text-primary-600 dark:text-primary-400 font-mono text-base font-bold">
                  {formatBDT(transaction.totalAmount ?? transaction.amount)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="bn">
                {t("wonDate")}:{" "}
                {new Date(transaction.auction.endTime).toLocaleDateString("en-US")}
              </span>
            </div>
          </div>

          <div className={cn(
            "w-full flex-shrink-0",
            layout !== 'vertical' && "md:w-64"
          )}>
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
                    {t("rejectionPolicyWarning")}
                  </p>
                </div>
              </div>
            )}
            
            {isVerifying && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                  <p className="text-xs font-bold bn uppercase">{t("awaitingAdminReview")}</p>
                </div>
                <p className="text-[10px] leading-relaxed bn">
                  {t("verificationQueueDesc")}
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
                    onClick={() => router.push(`/dashboard?tab=coordination`)}
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
        amount={transaction.amount}
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
