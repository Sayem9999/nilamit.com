"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getPendingNIDSubmissions,
  approveNIDSubmission,
  rejectNIDSubmission,
} from "@/actions/admin-users";
import { getNIDSignedUrls } from "@/actions/verification";
import {
  ShieldCheck, Clock, User as UserIcon, Eye, CheckCircle, XCircle,
  Loader2, FileCheck2,
} from "lucide-react";
import Image from "next/image";

interface PendingSubmission {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  isPhoneVerified: boolean;
  nidLast4: string | null;
  nidSubmittedAt: Date | null;
  nidFrontPath: string | null;
  nidBackPath: string | null;
}

export function VerificationTab() {
  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, { frontUrl: string; backUrl: string }>>({});
  const [rejectionText, setRejectionText] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getPendingNIDSubmissions();
    if (res.success) {
      setPending(
        res.submissions.map((s) => ({
          ...s,
          nidSubmittedAt: s.nidSubmittedAt ? new Date(s.nidSubmittedAt) : null,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getPendingNIDSubmissions();
      if (!active) return;
      if (res.success) {
        setPending(
          res.submissions.map((s) => ({
            ...s,
            nidSubmittedAt: s.nidSubmittedAt ? new Date(s.nidSubmittedAt) : null,
          })),
        );
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const handleExpand = async (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    if (!signedUrls[userId]) {
      const res = await getNIDSignedUrls(userId);
      if (res.success && res.frontUrl && res.backUrl) {
        const front = res.frontUrl;
        const back  = res.backUrl;
        setSignedUrls((prev) => ({
          ...prev,
          [userId]: { frontUrl: front, backUrl: back },
        }));
      }
    }
  };

  const handleApprove = (userId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await approveNIDSubmission(userId);
      if (res.success) {
        setPending((prev) => prev.filter((p) => p.id !== userId));
        setFeedback(`Approved submission for user ${userId.slice(0, 8)}…`);
      }
    });
  };

  const handleReject = (userId: string) => {
    const reason = rejectionText.trim();
    if (!reason) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await rejectNIDSubmission(userId, reason);
      if (res.success) {
        setPending((prev) => prev.filter((p) => p.id !== userId));
        setRejectingId(null);
        setRejectionText("");
        setFeedback(`Rejected submission for user ${userId.slice(0, 8)}…`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            NID Verification Queue
          </h2>
          <p className="text-sm text-gray-500">
            {pending.length} pending submission{pending.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-bold text-gray-600 hover:text-gray-900 uppercase tracking-wider px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {feedback && (
        <div role="status" className="bg-green-50 text-green-700 rounded-xl px-4 py-2 text-sm">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" aria-hidden="true" />
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400 bg-white rounded-xl border border-gray-100">
          <FileCheck2 className="w-10 h-10 mb-3" aria-hidden="true" />
          <p className="font-semibold text-gray-700">No pending submissions</p>
          <p className="text-sm">New NID submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const isRejecting = rejectingId === sub.id;
            const urls = signedUrls[sub.id];
            return (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {sub.image ? (
                        <Image
                          src={sub.image}
                          alt=""
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <UserIcon className="w-5 h-5 text-primary-500" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {sub.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {sub.email ?? sub.phone ?? "—"}
                        {sub.nidLast4 ? ` · NID ••••${sub.nidLast4}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sub.nidSubmittedAt && (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {timeAgo(sub.nidSubmittedAt)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleExpand(sub.id)}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-expanded={isExpanded}
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Review
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <NIDImagePreview label="Front" url={urls?.frontUrl} />
                      <NIDImagePreview label="Back" url={urls?.backUrl} />
                    </div>

                    {isRejecting ? (
                      <div className="space-y-2">
                        <label htmlFor={`reject-reason-${sub.id}`} className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Rejection reason (visible to user)
                        </label>
                        <textarea
                          id={`reject-reason-${sub.id}`}
                          value={rejectionText}
                          onChange={(e) => setRejectionText(e.target.value)}
                          rows={3}
                          maxLength={500}
                          placeholder="e.g. NID image is blurry, please resubmit a clearer photo."
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setRejectingId(null); setRejectionText(""); }}
                            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(sub.id)}
                            disabled={isPending || !rejectionText.trim()}
                            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-200 flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-4 h-4" aria-hidden="true" /> Confirm reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setRejectingId(sub.id); setRejectionText(""); }}
                          disabled={isPending}
                          className="flex-1 px-4 py-2 rounded-xl text-sm font-bold border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-4 h-4" aria-hidden="true" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(sub.id)}
                          disabled={isPending}
                          className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-200 flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NIDImagePreview({ label, url }: { label: string; url?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <div className="aspect-[4/3] rounded-xl bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
        {url ? (
          // Signed URL expires in 15 min — refresh if user keeps the tab open.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`NID ${label}`} className="w-full h-full object-contain" />
        ) : (
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
