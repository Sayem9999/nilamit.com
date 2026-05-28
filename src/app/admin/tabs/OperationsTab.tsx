"use client";

import { useState, useTransition } from "react";
import {
  Wrench,
  Megaphone,
  Hammer,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Power,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  setMaintenanceMode,
  forceCloseAuction,
  cancelBid,
  broadcastNotification,
  recomputeGlobalStats,
} from "@/actions/admin/ops";

interface Props {
  initialMaintenance: boolean;
  initialMaintenanceMessage?: string | null;
}

/**
 * Admin operations control panel.
 *
 * Four sections, each a card:
 *   1. Maintenance mode — flip the kill switch with optional banner message
 *   2. Broadcast — push a notification to all opted-in users (capped)
 *   3. Force-close auction — emergency state flip with reason
 *   4. Cancel bid — null a fraudulent bid (use after shill-detector flag)
 *   5. Recompute stats — rebuild denormalized counters
 *
 * Every action calls a Server Action in src/actions/admin/ops.ts which
 * writes an admin_logs row visible in the Audit Log tab.
 */
export function OperationsTab({
  initialMaintenance,
  initialMaintenanceMessage,
}: Props) {
  const [isPending, startTransition] = useTransition();

  // Maintenance state
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [maintMsg, setMaintMsg] = useState(initialMaintenanceMessage ?? "");

  // Broadcast state
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bUrl, setBUrl] = useState("");
  const [bMax, setBMax] = useState(1000);

  // Force-close
  const [fcAuctionId, setFcAuctionId] = useState("");
  const [fcReason, setFcReason] = useState("");
  const [fcResolution, setFcResolution] = useState<"CANCELLED" | "EXPIRED">("CANCELLED");

  // Cancel bid
  const [cbBidId, setCbBidId] = useState("");
  const [cbReason, setCbReason] = useState("");

  const handleMaintenance = () => {
    const wantedState = !maintenance;
    if (wantedState && !window.confirm("Enable maintenance mode for ALL users?")) return;
    startTransition(async () => {
      const res = await setMaintenanceMode(wantedState, maintMsg.trim() || undefined);
      if (res.success) {
        setMaintenance(wantedState);
        toast.success(wantedState ? "Maintenance mode ON" : "Maintenance mode OFF");
      } else {
        toast.error(res.error?.message || "Failed");
      }
    });
  };

  const handleBroadcast = () => {
    if (!bTitle.trim() || !bBody.trim()) {
      toast.error("Title + body required");
      return;
    }
    if (!window.confirm(`Send to up to ${bMax} users?`)) return;
    startTransition(async () => {
      const res = await broadcastNotification({
        title: bTitle.trim(),
        body: bBody.trim(),
        clickUrl: bUrl.trim() || undefined,
        maxRecipients: bMax,
      });
      if (res.success && res.data) {
        toast.success(`Sent to ${res.data.recipients} users`);
        setBTitle("");
        setBBody("");
        setBUrl("");
      } else {
        toast.error(res.error?.message || "Broadcast failed");
      }
    });
  };

  const handleForceClose = () => {
    if (!fcAuctionId.trim() || fcReason.length < 5) {
      toast.error("Auction ID + reason (≥5 chars) required");
      return;
    }
    if (!window.confirm(`Force-close auction ${fcAuctionId} as ${fcResolution}?`)) return;
    startTransition(async () => {
      const res = await forceCloseAuction({
        auctionId: fcAuctionId.trim(),
        reason: fcReason.trim(),
        resolution: fcResolution,
      });
      if (res.success) {
        toast.success("Auction force-closed");
        setFcAuctionId("");
        setFcReason("");
      } else {
        toast.error(res.error?.message || "Force-close failed");
      }
    });
  };

  const handleCancelBid = () => {
    if (!cbBidId.trim() || cbReason.length < 5) {
      toast.error("Bid ID + reason (≥5 chars) required");
      return;
    }
    if (!window.confirm(`Cancel bid ${cbBidId}?`)) return;
    startTransition(async () => {
      const res = await cancelBid({ bidId: cbBidId.trim(), reason: cbReason.trim() });
      if (res.success) {
        toast.success("Bid cancelled");
        setCbBidId("");
        setCbReason("");
      } else {
        toast.error(res.error?.message || "Cancel failed");
      }
    });
  };

  const handleRecompute = () => {
    if (!window.confirm("Recompute global stats (totalUsers / auctions / bids)?")) return;
    startTransition(async () => {
      const res = await recomputeGlobalStats();
      if (res.success) {
        toast.success("Stats recomputed");
      } else {
        toast.error(res.error?.message || "Recompute failed");
      }
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Operations Control</h2>

      {/* ─── Maintenance mode ────────────────────────────────────────── */}
      <OpsCard
        title="Maintenance mode"
        icon={<Power className={`w-5 h-5 ${maintenance ? "text-red-600" : "text-emerald-600"}`} />}
        accent={maintenance ? "border-red-300 bg-red-50/30" : ""}
      >
        <p className="text-xs text-gray-600 mb-2">
          {maintenance
            ? "Maintenance mode is ON — users see the banner / blocked write actions."
            : "System is healthy. Flip ON for short planned outages."}
        </p>
        <textarea
          value={maintMsg}
          onChange={(e) => setMaintMsg(e.target.value)}
          placeholder="Optional message shown to users (e.g. 'Back in 15 min — DB migration')"
          rows={2}
          maxLength={280}
          className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 mb-3 focus:ring-2 focus:ring-primary-500/30 outline-none resize-none"
        />
        <button
          onClick={handleMaintenance}
          disabled={isPending}
          className={`px-4 py-2 rounded-md text-sm font-bold text-white transition-colors disabled:opacity-50 ${
            maintenance ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : maintenance ? "Disable maintenance" : "Enable maintenance"}
        </button>
      </OpsCard>

      {/* ─── Broadcast ──────────────────────────────────────────────── */}
      <OpsCard title="Broadcast notification" icon={<Megaphone className="w-5 h-5 text-blue-600" />}>
        <p className="text-xs text-gray-600 mb-3">
          Fans out through every channel the recipient opted in to (in-app + FCM by default, plus SMS/WhatsApp if configured + opted in).
          Hard-capped to prevent runaway cost.
        </p>
        <div className="space-y-2">
          <input
            type="text"
            value={bTitle}
            onChange={(e) => setBTitle(e.target.value)}
            placeholder="Title (e.g. 'Eid Sale: 0% commission today!')"
            maxLength={80}
            className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none"
          />
          <textarea
            value={bBody}
            onChange={(e) => setBBody(e.target.value)}
            placeholder="Body — keep concise (under 280 chars)."
            rows={2}
            maxLength={280}
            className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none resize-none"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="url"
              value={bUrl}
              onChange={(e) => setBUrl(e.target.value)}
              placeholder="Click URL (optional)"
              className="col-span-2 text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none"
            />
            <input
              type="number"
              value={bMax}
              onChange={(e) => setBMax(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
              min={1}
              max={10000}
              className="text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleBroadcast}
          disabled={isPending}
          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `Send to ${bMax}`}
        </button>
      </OpsCard>

      {/* ─── Force close auction ────────────────────────────────────── */}
      <OpsCard title="Force-close auction" icon={<Hammer className="w-5 h-5 text-amber-600" />}>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-900 leading-snug">
            Emergency tool. Cancels any in-flight PENDING escrow. The seller and
            any active bidders see the auction terminated immediately.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={fcAuctionId}
            onChange={(e) => setFcAuctionId(e.target.value)}
            placeholder="Auction ID"
            className="text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none font-mono"
          />
          <select
            value={fcResolution}
            onChange={(e) => setFcResolution(e.target.value as "CANCELLED" | "EXPIRED")}
            className="text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none"
          >
            <option value="CANCELLED">CANCELLED — seller intent / fraud</option>
            <option value="EXPIRED">EXPIRED — clock issue / glitch</option>
          </select>
        </div>
        <textarea
          value={fcReason}
          onChange={(e) => setFcReason(e.target.value)}
          placeholder="Reason (visible in audit log; min 5 chars)"
          rows={2}
          maxLength={500}
          className="w-full mt-2 text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none resize-none"
        />
        <button
          onClick={handleForceClose}
          disabled={isPending}
          className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Force-close"}
        </button>
      </OpsCard>

      {/* ─── Cancel bid ─────────────────────────────────────────────── */}
      <OpsCard title="Cancel bid" icon={<Wrench className="w-5 h-5 text-red-600" />}>
        <p className="text-xs text-gray-600 mb-3">
          Use after shill-detector flags a bid + a moderator confirms. If the
          cancelled bid is the current top, the auction state is rolled back
          to starting price + flagged for a precise recompute via cron.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={cbBidId}
            onChange={(e) => setCbBidId(e.target.value)}
            placeholder="Bid ID"
            className="text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none font-mono"
          />
          <textarea
            value={cbReason}
            onChange={(e) => setCbReason(e.target.value)}
            placeholder="Reason (visible in audit log; min 5 chars)"
            rows={2}
            maxLength={500}
            className="text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500/30 outline-none resize-none"
          />
        </div>
        <button
          onClick={handleCancelBid}
          disabled={isPending}
          className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Cancel bid"}
        </button>
      </OpsCard>

      {/* ─── Recompute stats ────────────────────────────────────────── */}
      <OpsCard title="Recompute global stats" icon={<RefreshCw className="w-5 h-5 text-gray-600" />}>
        <p className="text-xs text-gray-600 mb-3">
          Rebuilds the homepage StatsBar counters (totalUsers / activeAuctions
          / totalBids / verifiedSellers) directly from collection counts. Use
          after a data migration if the denormalized counters look wrong.
        </p>
        <button
          onClick={handleRecompute}
          disabled={isPending}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-bold rounded-md transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Recompute now"}
        </button>
      </OpsCard>
    </div>
  );
}

function OpsCard({
  title,
  icon,
  accent = "",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-md p-4 ${accent}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}
