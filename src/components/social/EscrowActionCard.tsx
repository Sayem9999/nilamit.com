"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { simulateEscrowPayment } from "@/actions/escrow";
import { raiseDispute } from "@/actions/dispute";
import { ShieldCheck, Clock, CreditCard, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

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
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const formatMoney = (amount: number) => `৳ ${amount.toLocaleString()}`;

  const handleSimulatePayment = async () => {
    setLoading(true);
    const result = await simulateEscrowPayment(transaction.id);
    if (result.success) {
      toast.success(
        "Escrow Payment simulated successfully! Funds are now securely held.",
      );
      router.refresh();
    } else {
      toast.error(result.error || "Failed to process mock payment.");
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
      toast.success("Dispute raised. Funds are frozen until admin review.");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to raise dispute.");
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
          <CardTitle className="text-base">
            {isReleased && "Funds Released to Seller"}
            {isHeld && "Payment Secured (Escrow)"}
            {isPending && "Awaiting Your Payment"}
            {isDisputed && "Transaction Under Dispute"}
            {isRefunded && "Payment Refunded"}
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
            <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-1">
              {transaction.auction.title}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seller: {transaction.auction.seller.name || "Anonymous"}
            </p>

            <div className="mt-4 flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatMoney(transaction.amount)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>
                  Won on{" "}
                  {new Date(transaction.auction.endTime).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="md:w-64 flex-shrink-0">
            {isPending && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 hidden md:block">
                  Secure this transaction by transferring funds to the Nilamit
                  Escrow pool.
                </p>
                <Button
                  onClick={handleSimulatePayment}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? "Processing..." : "Simulate BKash/Card Payment"}
                </Button>
              </div>
            )}

            {isHeld && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 mb-3">
                  <p className="text-xs font-medium flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> SECURELY HELD
                  </p>
                  <p className="text-[10px] opacity-80 leading-tight">
                    Your funds are safe. Don&apos;t confirm receipt until you
                    inspect the item.
                  </p>
                </div>
                <Button
                  onClick={handleRaiseDispute}
                  disabled={loading}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Raise Dispute
                </Button>
              </div>
            )}

            {isDisputed && (
              <div className="p-4 bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900 rounded-lg text-red-800 dark:text-red-300">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> UNDER DISPUTE
                </p>
                <p className="text-xs opacity-90">
                  A moderator is reviewing this transaction. Funds are frozen.
                </p>
                {transaction.dispute?.reason && (
                  <div className="mt-2 pt-2 border-t border-red-200 text-[10px] italic">
                    &quot;{transaction.dispute.reason}&quot;
                  </div>
                )}
              </div>
            )}

            {isReleased && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-lg text-emerald-800 dark:text-emerald-300">
                <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Payment Released
                </p>
                <p className="text-xs opacity-90">
                  Transaction completed successfully. The seller has received
                  their funds.
                </p>
              </div>
            )}

            {isRefunded && (
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-purple-800">
                <p className="text-sm font-bold mb-1 flex items-center gap-1.5">
                  Funds Refunded
                </p>
                <p className="text-xs opacity-90">
                  The dispute was resolved in your favor and funds have been
                  returned.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
