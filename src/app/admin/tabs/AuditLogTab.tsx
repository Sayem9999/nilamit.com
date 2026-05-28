"use client";

import { useEffect, useState, useTransition } from "react";
import { listAuditLog } from "@/actions/admin/ops";
import { Clock, User, FileText, Loader2 } from "lucide-react";

interface Row {
  id: string;
  adminId: string;
  action: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | null;
}

/**
 * Admin audit log viewer — what admins have done, when, to whom.
 *
 * Auto-loads the newest 100. "Load more" paginates by passing the oldest
 * createdAt as the cursor. No search yet — flat scrolling list is fine
 * for the current volume; revisit if log size > 10k entries.
 *
 * Action codes are domain-specific (KYC_APPROVE / FORCE_CLOSE_AUCTION /
 * CANCEL_BID / MAINTENANCE_ENABLE / BROADCAST_NOTIFICATION / …) and
 * colour-coded for quick visual scan.
 */
const ACTION_COLORS: Record<string, string> = {
  KYC_APPROVE: "text-emerald-700 bg-emerald-50 border-emerald-200",
  KYC_REJECT: "text-red-700 bg-red-50 border-red-200",
  FORCE_CLOSE_AUCTION: "text-amber-700 bg-amber-50 border-amber-200",
  CANCEL_BID: "text-red-700 bg-red-50 border-red-200",
  MAINTENANCE_ENABLE: "text-amber-700 bg-amber-50 border-amber-200",
  MAINTENANCE_DISABLE: "text-emerald-700 bg-emerald-50 border-emerald-200",
  BROADCAST_NOTIFICATION: "text-blue-700 bg-blue-50 border-blue-200",
  RECOMPUTE_STATS: "text-gray-700 bg-gray-50 border-gray-200",
};

export function AuditLogTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await listAuditLog(100);
      if (res.success && res.data) {
        setRows(res.data);
        if (res.data.length < 100) setHasMore(false);
      }
      setLoading(false);
    })();
  }, []);

  const loadMore = () => {
    const oldest = rows[rows.length - 1];
    if (!oldest?.createdAt) return;
    startTransition(async () => {
      const res = await listAuditLog(100, oldest.createdAt!.getTime());
      if (res.success && res.data) {
        setRows((prev) => [...prev, ...res.data!]);
        if (res.data.length < 100) setHasMore(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="mt-3 text-sm">Loading audit log…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-900">Audit Log</h2>
        <span className="text-xs font-semibold text-gray-500">
          {rows.length} entries
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden divide-y divide-gray-200">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">No admin actions yet.</div>
        ) : (
          rows.map((r) => {
            const colorClass = ACTION_COLORS[r.action] || "text-gray-700 bg-gray-50 border-gray-200";
            return (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50">
                <span
                  className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${colorClass} shrink-0`}
                >
                  {r.action.replace(/_/g, " ").toLowerCase()}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="font-mono truncate">{r.adminId.slice(0, 12)}…</span>
                    {r.targetId && (
                      <>
                        <span className="text-gray-300">→</span>
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="font-mono truncate">{r.targetId.slice(0, 16)}…</span>
                      </>
                    )}
                  </div>
                  {r.reason && (
                    <p className="text-sm text-gray-700 mt-1 leading-snug">{r.reason}</p>
                  )}
                  {r.metadata && Object.keys(r.metadata).length > 0 && (
                    <pre className="text-[10px] text-gray-500 mt-1 font-mono whitespace-pre-wrap break-all bg-gray-50 px-2 py-1 rounded">
                      {JSON.stringify(r.metadata, null, 0).slice(0, 200)}
                    </pre>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 shrink-0 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {r.createdAt ? r.createdAt.toLocaleString() : "—"}
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore && rows.length > 0 && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-50"
          >
            {isPending ? "Loading…" : "Load older"}
          </button>
        </div>
      )}
    </div>
  );
}
