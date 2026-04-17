"use client";

import { useEffect, useState, useTransition } from "react";
import { getOpenDisputes, resolveDispute } from "@/actions/dispute";
import { formatBDT } from "@/lib/format";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

interface Dispute {
  id: string;
  reason: string;
  createdAt: string | Date;
  transactionId: string;
  opener: { name: string | null; email: string | null };
  transaction: {
    amount: number;
    auctionId: string;
    auction: { title: string; seller: { name: string | null } };
  };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchDisputes = async () => {
    setLoading(true);
    const data = await getOpenDisputes();
    setDisputes(data as unknown as Dispute[]);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await getOpenDisputes();
      if (mounted) {
        setDisputes(data as unknown as Dispute[]);
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleResolve = (disputeId: string, ruling: "SELLER" | "BUYER") => {
    const resolutionText = window.prompt(
      `Enter resolution notes for this ${ruling === "SELLER" ? "Seller" : "Buyer"} victory:`,
    );
    if (!resolutionText) return;

    startTransition(async () => {
      const res = await resolveDispute(disputeId, ruling, resolutionText);
      if (res.success) {
        toast.success("Dispute resolved successfully.");
        fetchDisputes();
      } else {
        toast.error(res.error || "Failed to resolve dispute.");
      }
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-4" />
        <p className="text-gray-500">Loading open disputes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
            Dispute Moderation
          </h1>
          <p className="text-gray-500">
            Review and resolve transaction conflicts between buyers and sellers.
          </p>
        </div>
        <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          {disputes.length} Pending Disputes
        </div>
      </div>

      {disputes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            All Clear!
          </h3>
          <p className="text-gray-500">No open disputes requiring attention.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">
                      <Clock className="w-3 h-3" />
                      Opened {new Date(dispute.createdAt).toLocaleDateString()}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {dispute.transaction.auction.title}
                    </h3>

                    <div className="space-y-3 mb-6">
                      <div className="bg-gray-50 p-4 rounded-2xl italic text-gray-600 text-sm border-l-4 border-amber-400">
                        &quot;{dispute.reason}&quot;
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">
                              Buyer (Opener)
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {dispute.opener.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">
                              Seller
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {dispute.transaction.auction.seller.name}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 py-3 border-t border-gray-50">
                      <span className="text-sm font-bold text-primary-700">
                        Value: {formatBDT(dispute.transaction.amount)}
                      </span>
                      <a
                        href={`/auctions/${dispute.transaction.auctionId}`}
                        target="_blank"
                        className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1"
                      >
                        View Auction <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="lg:w-72 bg-gray-50 p-6 rounded-2xl flex flex-col justify-center gap-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Moderator Ruling
                    </p>

                    <button
                      onClick={() => handleResolve(dispute.id, "SELLER")}
                      disabled={isPending}
                      className="w-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Release to Seller
                    </button>

                    <button
                      onClick={() => handleResolve(dispute.id, "BUYER")}
                      disabled={isPending}
                      className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refund Buyer
                    </button>

                    <p className="text-[10px] text-gray-400 text-center mt-2 leading-tight">
                      Ruling is final. Funds will be moved instantly and all
                      parties notified.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
