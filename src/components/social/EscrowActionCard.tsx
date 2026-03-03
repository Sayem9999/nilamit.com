"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { simulateEscrowPayment } from "@/actions/escrow";
import { ShieldCheck, Clock, CreditCard, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export function EscrowActionCard({ transaction }: { transaction: any }) {
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

  const isPending =
    transaction.status === "HELD" || transaction.status === "PENDING";
  const isReleased = transaction.status === "RELEASED";

  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 py-4 flex flex-row items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className={`w-5 h-5 ${isReleased ? "text-emerald-500" : "text-amber-500"}`}
          />
          <CardTitle className="text-base">
            {isReleased
              ? "Escrow Funded (Awaiting Shipment)"
              : "Awaiting Escrow Transfer"}
          </CardTitle>
        </div>
        <span className="font-mono text-sm uppercase px-2 py-0.5 bg-slate-200 dark:bg-slate-800 rounded">
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

            {isReleased && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-lg text-emerald-800 dark:text-emerald-300">
                <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Payment Secured
                </p>
                <p className="text-xs opacity-90">
                  Seller has been notified to ship the item. Funds will be
                  released to them upon delivery confirmation.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
