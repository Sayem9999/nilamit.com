"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getAdminReports,
  resolveReport,
  suspendAuction,
  getAdminAuctions,
  adminTakeDownAuction,
  adminDeleteAuction,
} from "@/actions/admin-moderation";
import { 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Ban, 
  Trash2, 
  ShieldAlert, 
  FileText, 
  PackageOpen, 
  AlertTriangle,
  Loader2 
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";

type Mode = "REPORTS" | "ALL_AUCTIONS";

export function ModerationTab() {
  interface AdminReport {
    id: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    auction: {
      id: string;
      title: string;
      status: string;
      images: string[];
      seller: { name: string | null; email: string };
    };
    reporter: { name: string | null; email: string; image: string | null };
  }

  interface AdminAuction {
    id: string;
    title: string;
    status: string;
    images: string[];
    currentPrice: number;
    createdAt: string | Date;
    seller: { name: string | null; email: string | null };
    _count: { bids: number };
  }

  const [mode, setMode] = useState<Mode>("REPORTS");

  // Reports state
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<"PENDING" | "RESOLVED">("PENDING");
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsRetry, setReportsRetry] = useState(0);

  // Auctions state
  const [auctions, setAuctions] = useState<AdminAuction[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);
  const [auctionFilter, setAuctionFilter] = useState<string>("all");
  const [auctionPage, setAuctionPage] = useState(1);
  const [auctionTotalPages, setAuctionTotalPages] = useState(1);
  const [auctionsError, setAuctionsError] = useState<string | null>(null);
  const [auctionsRetry, setAuctionsRetry] = useState(0);

  const [isPending, startTransition] = useTransition();

  // Action states for overlay / prompt dialogues
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"SUSPEND" | "DELETE" | null>(null);
  const [actionReason, setActionReason] = useState("");

  // Load Reports
  useEffect(() => {
    if (mode !== "REPORTS") return;
    let mounted = true;
    const load = async () => {
      setReportsLoading(true);
      setReportsError(null);
      const res = await getAdminReports(reportFilter, reportPage);
      if (mounted) {
        if (res.success && res.data) {
          setReports((res.data.reports as unknown as AdminReport[]) || []);
          setReportTotalPages(res.data.pages || 1);
          setReportsError(null);
        } else {
          setReports([]);
          setReportsError(res.error?.message || "Failed to load user reports queue.");
        }
        setReportsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [mode, reportFilter, reportPage, reportsRetry]);

  // Load Auctions
  useEffect(() => {
    if (mode !== "ALL_AUCTIONS") return;
    let mounted = true;
    const load = async () => {
      setAuctionsLoading(true);
      setAuctionsError(null);
      const statusParam = auctionFilter === "all" ? undefined : auctionFilter;
      const res = await getAdminAuctions(auctionPage, 10, statusParam);
      if (mounted) {
        if (res.success && res.data) {
          setAuctions((res.data.auctions as unknown as AdminAuction[]) || []);
          setAuctionTotalPages(res.data.pages || 1);
          setAuctionsError(null);
        } else {
          setAuctions([]);
          setAuctionsError(res.error?.message || "Failed to load database listings.");
        }
        setAuctionsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [mode, auctionFilter, auctionPage, auctionsRetry]);

  const handleDismissReport = (id: string) => {
    if (!confirm("Dismiss this report?")) return;
    startTransition(async () => {
      const res = await resolveReport(id, "DISMISSED");
      if (res.success) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(res.error?.message || "Failed to dismiss report");
      }
    });
  };

  const handleSuspendReport = (auctionId: string, reportId: string) => {
    if (
      !confirm(
        "Are you sure you want to suspend this auction? This cannot be undone easily.",
      )
    )
      return;
    startTransition(async () => {
      const res = await suspendAuction(auctionId, reportId, "Moderator action");
      if (res.success) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      } else {
        toast.error(res.error?.message || "Failed to suspend auction");
      }
    });
  };

  const triggerAuctionAction = (id: string, type: "SUSPEND" | "DELETE") => {
    setActioningId(id);
    setActionType(type);
    setActionReason("");
  };

  const submitAuctionAction = () => {
    if (!actioningId || !actionType) return;
    if (!actionReason.trim()) {
      toast.error("Please enter a valid reason for this operation.");
      return;
    }

    startTransition(async () => {
      if (actionType === "SUSPEND") {
        const res = await adminTakeDownAuction(actioningId, actionReason);
        if (res.success) {
          toast.success("Auction has been successfully suspended.");
          // Refresh lists
          setAuctions((prev) =>
            prev.map((a) => (a.id === actioningId ? { ...a, status: "CANCELLED" } : a))
          );
          setActioningId(null);
          setActionType(null);
        } else {
          toast.error(res.error?.message || "Failed to suspend auction.");
        }
      } else if (actionType === "DELETE") {
        const res = await adminDeleteAuction(actioningId, actionReason);
        if (res.success) {
          toast.success("Auction has been permanently deleted from the database.");
          setAuctions((prev) => prev.filter((a) => a.id !== actioningId));
          setActioningId(null);
          setActionType(null);
        } else {
          toast.error(res.error?.message || "Failed to permanently delete auction.");
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab bar header */}
      <div className="border-b border-gray-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-600" />
              Administrative Moderation Panel
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Securely moderate posts, take down illegal auctions, or inspect database listings.
            </p>
          </div>

          <div className="flex bg-gray-100 p-1.5 rounded-md self-start sm:self-center border border-gray-200">
            <button
              onClick={() => setMode("REPORTS")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${mode === "REPORTS" ? "bg-slate-900 shadow-sm text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              <FileText className="w-3.5 h-3.5" />
              User Reports Queue
            </button>
            <button
              onClick={() => setMode("ALL_AUCTIONS")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${mode === "ALL_AUCTIONS" ? "bg-slate-900 shadow-sm text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              <PackageOpen className="w-3.5 h-3.5" />
              All Listings
            </button>
          </div>
        </div>
      </div>

      {/* --- REPORTS QUEUE MODE --- */}
      {mode === "REPORTS" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Filter queue status
            </span>
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => { setReportFilter("PENDING"); setReportPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportFilter === "PENDING" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"}`}
              >
                Pending Reports
              </button>
              <button
                onClick={() => { setReportFilter("RESOLVED"); setReportPage(1); }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${reportFilter === "RESOLVED" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"}`}
              >
                Resolved Reports
              </button>
            </div>
          </div>

          {reportsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin w-8 h-8 text-primary-600" />
            </div>
          ) : reportsError ? (
            <div className="text-center py-16 bg-red-50/50 rounded-md border-2 border-dashed border-red-200/50">
              <AlertTriangle className="w-12 h-12 text-red-500/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-950 tracking-tight">Failed to Load Reports</h3>
              <p className="text-red-700 text-xs mt-1">
                {reportsError}
              </p>
              <button
                onClick={() => setReportsRetry((prev) => prev + 1)}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Retry Query
              </button>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 bg-gray-50/50 rounded-md border-2 border-dashed border-gray-200">
              <CheckCircle className="w-12 h-12 text-green-500/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">Queue Clear!</h3>
              <p className="text-gray-500 text-xs mt-1">
                No reported listings found under {reportFilter.toLowerCase()}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white p-5 rounded-md border border-gray-100 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row gap-6 relative"
                >
                  {/* Image Preview */}
                  <div className="w-full lg:w-48 h-32 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative border border-gray-100">
                    {report.auction.images[0] ? (
                      <Image
                        src={report.auction.images[0]}
                        alt="Auction Preview"
                        fill
                        sizes="192px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase">
                        No image
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase bg-slate-900 text-white shadow-xs">
                      {report.auction.status}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div>
                        <Link
                          href={`/auctions/${report.auction.id}`}
                          target="_blank"
                          className="font-heading font-bold text-base text-gray-900 hover:text-primary-600 transition-colors flex items-center gap-1.5"
                        >
                          {report.auction.title}
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        </Link>
                        <p className="text-xs text-gray-500 mt-1">
                          Seller: <span className="font-semibold text-gray-700">{report.auction.seller.name || report.auction.seller.email}</span> • Reporter: <span className="font-semibold text-gray-700">{report.reporter.name || report.reporter.email}</span>
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 self-start">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="bg-red-50/50 border border-red-100/50 text-red-900 p-3.5 rounded-xl text-xs mb-4">
                      <strong className="block text-[10px] uppercase tracking-wider text-red-700 font-bold mb-1">
                        Reason: {report.reason}
                      </strong>
                      <p className="text-slate-600 font-medium leading-relaxed">
                        {report.description || "No elaboration provided by the reporter."}
                      </p>
                    </div>

                    {reportFilter === "PENDING" && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100/50">
                        <button
                          onClick={() => handleDismissReport(report.id)}
                          disabled={isPending}
                          className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4 text-gray-400" /> Dismiss Report
                        </button>
                        <button
                          onClick={() => handleSuspendReport(report.auction.id, report.id)}
                          disabled={isPending || report.auction.status !== "ACTIVE"}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Ban className="w-4 h-4" /> Suspend Listing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {reportTotalPages > 1 && (
                <div className="flex items-center justify-between py-4 border-t border-gray-100 pt-6">
                  <p className="text-xs text-gray-500 font-medium">
                    Page {reportPage} of {reportTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                      disabled={reportPage === 1}
                      className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setReportPage((p) => Math.min(reportTotalPages, p + 1))}
                      disabled={reportPage === reportTotalPages}
                      className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- ALL LISTINGS MODE --- */}
      {mode === "ALL_AUCTIONS" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Filter database listings by state
            </span>
            <div className="flex flex-wrap bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-center">
              {[
                { id: "all", label: "All State" },
                { id: "ACTIVE", label: "Active" },
                { id: "SOLD", label: "Sold" },
                { id: "CANCELLED", label: "Suspended" },
                { id: "EXPIRED", label: "Expired" }
              ].map((filterTab) => (
                <button
                  key={filterTab.id}
                  onClick={() => { setAuctionFilter(filterTab.id); setAuctionPage(1); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${auctionFilter === filterTab.id ? "bg-slate-900 text-white shadow-xs" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {filterTab.label}
                </button>
              ))}
            </div>
          </div>

          {auctionsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin w-8 h-8 text-primary-600" />
            </div>
          ) : auctionsError ? (
            <div className="text-center py-16 bg-red-50/50 rounded-md border-2 border-dashed border-red-200/50">
              <AlertTriangle className="w-12 h-12 text-red-500/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-red-950 tracking-tight">Failed to Load Listings</h3>
              <p className="text-red-700 text-xs mt-1">
                {auctionsError}
              </p>
              <button
                onClick={() => setAuctionsRetry((prev) => prev + 1)}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Retry Query
              </button>
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-16 bg-gray-50/50 rounded-md border-2 border-dashed border-gray-200">
              <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">No Listings</h3>
              <p className="text-gray-500 text-xs mt-1">
                No auctions found matching state: <strong className="text-slate-900">{auctionFilter}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {auctions.map((auction) => (
                <div
                  key={auction.id}
                  className="bg-white p-5 rounded-md border border-gray-100 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row gap-6 items-start"
                >
                  {/* Preview thumb */}
                  <div className="w-full md:w-32 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative border border-gray-100">
                    {auction.images[0] ? (
                      <Image
                        src={auction.images[0]}
                        alt="Auction Preview"
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px] font-bold uppercase">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1">
                      <div>
                        <Link
                          href={`/auctions/${auction.id}`}
                          target="_blank"
                          className="font-heading font-bold text-base text-gray-900 hover:text-primary-600 transition-colors flex items-center gap-1.5"
                        >
                          {auction.title}
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        </Link>
                        <p className="text-xs text-gray-500 mt-1">
                          Seller: <span className="font-semibold text-gray-700">{auction.seller.name || auction.seller.email}</span> • Price: <span className="font-semibold text-slate-800">৳{auction.currentPrice.toLocaleString()}</span> • Bids: <span className="font-semibold text-slate-800">{auction._count.bids}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase shrink-0 ${
                          auction.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                          auction.status === "SOLD" ? "bg-indigo-100 text-indigo-800" :
                          auction.status === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"
                        }`}>
                          {auction.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-gray-100/50">
                      <Link
                        href={`/auctions/${auction.id}`}
                        target="_blank"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> Inspect page
                      </Link>

                      {auction.status === "ACTIVE" && (
                        <button
                          onClick={() => triggerAuctionAction(auction.id, "SUSPEND")}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/50 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" /> Suspend / Take Down
                        </button>
                      )}

                      <button
                        onClick={() => triggerAuctionAction(auction.id, "DELETE")}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/50 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Permanently Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {auctionTotalPages > 1 && (
                <div className="flex items-center justify-between py-4 border-t border-gray-100 pt-6">
                  <p className="text-xs text-gray-500 font-medium">
                    Page {auctionPage} of {auctionTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuctionPage((p) => Math.max(1, p - 1))}
                      disabled={auctionPage === 1}
                      className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setAuctionPage((p) => Math.min(auctionTotalPages, p + 1))}
                      disabled={auctionPage === auctionTotalPages}
                      className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* OVERLAY DIALOGUE (Suspension & Deletion Confirmations) */}
      {actioningId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-md p-6 shadow-md border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-heading font-bold text-lg tracking-tight">
                Confirm {actionType === "SUSPEND" ? "Listing Suspension" : "Permanent Deletion"}
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              {actionType === "SUSPEND" ? (
                "Suspension will terminate live bidding and flag the listing as CANCELLED. The seller's account will be penalised with a policy violation increment. This operation is fully audited."
              ) : (
                "WARNING: Deletion will permanently scrub this listing, all related bid histories, and real-time socket connections from the database. This action cannot be reverted."
              )}
            </p>

            <textarea
              placeholder="Reason for administrative intervention (Required)..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-slate-900 outline-none text-slate-800"
              rows={3}
            />

            <div className="flex justify-end gap-2.5 mt-5">
              <button
                onClick={() => { setActioningId(null); setActionType(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitAuctionAction}
                disabled={isPending}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  actionType === "SUSPEND" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
