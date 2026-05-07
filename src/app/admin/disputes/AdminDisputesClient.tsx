"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
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

interface ResolveModalState {
  disputeId: string;
  ruling: "SELLER" | "BUYER";
}

export default function AdminDisputesClient() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<ResolveModalState | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const fetchDisputes = useCallback(async () => {
    const res = await getOpenDisputes();
    setDisputes(res.success ? (res.data as Dispute[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDisputes();
  }, [fetchDisputes]);

  const submitResolution = () => {
    if (!modal) return;
    const text = resolutionText.trim();
    if (!text) {
      toast.error("Resolution notes are required.");
      return;
    }

    const { disputeId, ruling } = modal;

    startTransition(async () => {
      const res = await resolveDispute(disputeId, ruling, text);
      if (res.success) {
        toast.success("Dispute resolved successfully.");
        setModal(null);
        setResolutionText("");
        fetchDisputes();
      } else {
        toast.error(res.error?.message || "Failed to resolve dispute.");
      }
    });
  };

  if (loading) {
    return (
      <main
        className="max-w-6xl mx-auto p-8 flex flex-col items-center justify-center min-h-[50vh]"
        aria-busy="true"
        aria-live="polite"
      >
        <RefreshCw
          className="w-8 h-8 text-primary-500 animate-spin motion-reduce:animate-none mb-4"
          aria-hidden="true"
        />
        <p className="text-gray-500">Loading open disputes…</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900 mb-2">
            Dispute moderation
          </h1>
          <p className="text-gray-500">
            Review and resolve transaction conflicts between buyers and sellers.
          </p>
        </div>
        <div
          className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-100 flex items-center gap-2 text-sm font-medium"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          {disputes.length} pending {disputes.length === 1 ? "dispute" : "disputes"}
        </div>
      </header>

      {disputes.length === 0 ? (
        <div
          role="status"
          className="bg-white border border-dashed border-gray-200 rounded-3xl p-12 text-center"
        >
          <div
            className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"
            aria-hidden="true"
          >
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">All clear</h2>
          <p className="text-gray-500">No open disputes require your attention right now.</p>
        </div>
      ) : (
        <ul className="grid gap-6 list-none p-0">
          {disputes.map((dispute) => (
            <li
              key={dispute.id}
              className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden hover:shadow-md transition-shadow motion-reduce:transition-none"
            >
              <article className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      <span>
                        Opened{" "}
                        <time dateTime={new Date(dispute.createdAt).toISOString()}>
                          {new Date(dispute.createdAt).toLocaleDateString()}
                        </time>
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {dispute.transaction.auction.title}
                    </h2>

                    <div className="space-y-3 mb-6">
                      <blockquote className="bg-gray-50 p-4 rounded-2xl italic text-gray-600 text-sm border-l-4 border-amber-400">
                        {dispute.reason}
                      </blockquote>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
                            <User className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">
                              Buyer (opener)
                            </p>
                            <p className="text-sm font-medium text-gray-700">
                              {dispute.opener.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
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
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                      >
                        View auction <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-label={`Moderator ruling for ${dispute.transaction.auction.title}`}
                    className="lg:w-72 bg-gray-50 p-6 rounded-2xl flex flex-col justify-center gap-3"
                  >
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Moderator ruling
                    </p>

                    <button
                      type="button"
                      onClick={() => { setModal({ disputeId: dispute.id, ruling: "SELLER" }); setResolutionText(""); }}
                      disabled={isPending}
                      className="w-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all motion-reduce:transition-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    >
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      Release to seller
                    </button>

                    <button
                      type="button"
                      onClick={() => { setModal({ disputeId: dispute.id, ruling: "BUYER" }); setResolutionText(""); }}
                      disabled={isPending}
                      className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all motion-reduce:transition-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      <RefreshCw className="w-4 h-4" aria-hidden="true" />
                      Refund buyer
                    </button>

                    <p className="text-[10px] text-gray-400 text-center mt-2 leading-tight">
                      Ruling is final. Funds move instantly and both parties are notified.
                    </p>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-dispute-heading"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isPending) {
              setModal(null);
              setResolutionText("");
            }
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6">
            <h2
              id="resolve-dispute-heading"
              className="text-lg font-heading font-bold text-gray-900 mb-1"
            >
              Resolve in favor of {modal.ruling === "SELLER" ? "seller" : "buyer"}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Enter resolution notes that will be recorded in the audit log and shared with both parties.
            </p>
            <label htmlFor="resolution-notes" className="sr-only">
              Resolution notes
            </label>
            <textarea
              id="resolution-notes"
              autoFocus
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              maxLength={2000}
              rows={5}
              required
              aria-required="true"
              placeholder="e.g. Item received in described condition; seller honored shipment SLA."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              disabled={isPending}
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">
              {resolutionText.length}/2000
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setModal(null); setResolutionText(""); }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResolution}
                disabled={isPending || !resolutionText.trim()}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  modal.ruling === "SELLER"
                    ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
                    : "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                }`}
              >
                {isPending ? "Submitting…" : "Confirm ruling"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
