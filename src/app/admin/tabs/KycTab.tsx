"use client";

import { useState, useEffect, useTransition } from "react";
import { listPendingKyc, approveKyc, rejectKyc } from "@/actions/kyc";
import { ShieldCheck, Loader2, ExternalLink, Check, X } from "lucide-react";
import toast from "react-hot-toast";

interface KycRow {
  userId: string;
  submittedAt: Date | string | null;
  docs: {
    nidFrontUrl?: string;
    nidBackUrl?: string;
    selfieUrl?: string;
    tradeLicenseUrl?: string;
  } | null;
}

/**
 * Admin KYC moderation queue. Shows the 50 oldest-pending submissions;
 * moderator views each doc (opens signed URL in a new tab) then
 * approves or rejects with a typed reason.
 *
 * No bulk-action UI — each KYC needs human eyes on the documents.
 */
export function KycTab() {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    void (async () => {
      try {
        const res = await listPendingKyc();
        if (res.success && res.data) {
          setRows(
            res.data.map((r) => ({
              userId: r.userId,
              submittedAt: r.submittedAt,
              docs: r.docs as KycRow["docs"],
            })),
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    reload();
  }, []);

  const handleApprove = (userId: string) => {
    setActingOn(userId);
    startTransition(async () => {
      const res = await approveKyc(userId);
      setActingOn(null);
      if (res.success) {
        toast.success(`Approved ${userId.slice(0, 8)}…`);
        setRows((prev) => prev.filter((r) => r.userId !== userId));
      } else {
        toast.error(res.error?.message || "Approval failed");
      }
    });
  };

  const handleReject = (userId: string) => {
    const reason = window.prompt(
      "Rejection reason (will be shown to the seller):",
    );
    if (!reason || reason.length < 5) return;
    setActingOn(userId);
    startTransition(async () => {
      const res = await rejectKyc(userId, reason);
      setActingOn(null);
      if (res.success) {
        toast.success("Rejected with reason");
        setRows((prev) => prev.filter((r) => r.userId !== userId));
      } else {
        toast.error(res.error?.message || "Rejection failed");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="mt-3 text-sm">Loading queue…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
        <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <h3 className="font-bold text-gray-900 text-base">No pending KYC</h3>
        <p className="text-sm text-gray-500 mt-1">All caught up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">KYC Queue</h2>
        <span className="text-xs font-semibold text-gray-500">
          {rows.length} pending
        </span>
      </div>

      {rows.map((row) => (
        <div
          key={row.userId}
          className="bg-white border border-gray-200 rounded-md p-4 flex items-start gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">User</p>
            <p className="text-sm font-mono text-gray-900 truncate">{row.userId}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Submitted: {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {row.docs?.nidFrontUrl && (
                <DocLink label="NID front" url={row.docs.nidFrontUrl} />
              )}
              {row.docs?.nidBackUrl && (
                <DocLink label="NID back" url={row.docs.nidBackUrl} />
              )}
              {row.docs?.selfieUrl && (
                <DocLink label="Selfie" url={row.docs.selfieUrl} />
              )}
              {row.docs?.tradeLicenseUrl && (
                <DocLink label="Trade license" url={row.docs.tradeLicenseUrl} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => handleApprove(row.userId)}
              disabled={isPending && actingOn === row.userId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-md transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              onClick={() => handleReject(row.userId)}
              disabled={isPending && actingOn === row.userId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 border border-red-200 text-xs font-bold rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-[11px] font-semibold text-gray-700"
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
