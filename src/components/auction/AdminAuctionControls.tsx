'use client';

import { useState, useTransition } from 'react';
import { Shield, Ban, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { adminTakeDownAuction, adminDeleteAuction } from '@/actions/admin-moderation';
import { useRouter } from 'next/navigation';

interface AdminAuctionControlsProps {
  auctionId: string;
  auctionTitle: string;
}

export function AdminAuctionControls({ auctionId, auctionTitle }: AdminAuctionControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirmTakedown, setShowConfirmTakedown] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [reason, setReason] = useState('');

  const handleTakedown = () => {
    if (!reason.trim()) {
      alert('Please provide a reason for taking down this auction.');
      return;
    }

    startTransition(async () => {
      const res = await adminTakeDownAuction(auctionId, reason);
      if (res.success) {
        alert('Auction listing has been successfully suspended/taken down.');
        router.refresh();
        setShowConfirmTakedown(false);
      } else {
        alert(res.error?.message || 'Failed to take down auction.');
      }
    });
  };

  const handleDelete = () => {
    if (!reason.trim()) {
      alert('Please provide a reason for permanently deleting this auction.');
      return;
    }

    startTransition(async () => {
      const res = await adminDeleteAuction(auctionId, reason);
      if (res.success) {
        alert('Auction listing has been permanently deleted from Nilamit database.');
        router.push('/');
        setShowConfirmDelete(false);
      } else {
        alert(res.error?.message || 'Failed to delete auction.');
      }
    });
  };

  return (
    <div className="w-full bg-slate-900 text-white rounded-md p-5 mb-8 border-2 border-red-500/30 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-2 h-full bg-red-600 animate-pulse" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-red-500/10 p-2.5 rounded-md text-red-500 border border-red-500/20 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-heading font-bold text-lg tracking-tight text-white">
                Admin Control Terminal
              </h4>
              <span className="bg-red-500/20 text-red-400 text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded border border-red-500/30">
                Authorized Only
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Directly take down or permanently wipe this active post. All actions are compiled in audit logs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={() => {
              setShowConfirmTakedown(true);
              setShowConfirmDelete(false);
              setReason('');
            }}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 px-4 rounded-md flex items-center gap-2 transition-colors border border-amber-500/30 disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            Take Down / Suspend
          </button>
          
          <button
            onClick={() => {
              setShowConfirmDelete(true);
              setShowConfirmTakedown(false);
              setReason('');
            }}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-4 rounded-md flex items-center gap-2 transition-colors border border-red-500/30 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Wipe Permanently
          </button>
        </div>
      </div>

      {/* Confirm Takedown Dialog */}
      {showConfirmTakedown && (
        <div className="mt-5 pt-5 border-t border-slate-800 animate-in slide-in-from-top-3 duration-200">
          <div className="flex gap-2 text-amber-500 mb-3 items-center">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold text-sm">Confirm Suspend Listing</span>
          </div>
          <p className="text-xs text-slate-300 mb-4">
            This will mark the auction as <strong className="text-white">CANCELLED</strong>, terminate live bidding, and increment the seller&apos;s defect rating.
          </p>
          <div className="space-y-3">
            <textarea
              placeholder={`Reason for taking down "${auctionTitle}" (Required)...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-md p-3 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmTakedown(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3.5 rounded-md text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTakedown}
                disabled={isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white py-1.5 px-4 rounded-md text-xs font-bold flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                Confirm Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Permanent Delete Dialog */}
      {showConfirmDelete && (
        <div className="mt-5 pt-5 border-t border-slate-800 animate-in slide-in-from-top-3 duration-200">
          <div className="flex gap-2 text-red-500 mb-3 items-center">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold text-sm">Confirm Permanent Wipe</span>
          </div>
          <p className="text-xs text-slate-300 mb-4">
            <span className="text-red-400 font-bold">WARNING:</span> This will permanently delete <strong className="text-white">&quot;{auctionTitle}&quot;</strong>, all related bid histories, report queues, and RTDB socket nodes. This action cannot be reversed.
          </p>
          <div className="space-y-3">
            <textarea
              placeholder={`Reason for permanent database deletion of "${auctionTitle}" (Required)...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-md p-3 text-xs focus:ring-2 focus:ring-red-500 outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3.5 rounded-md text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 text-white py-1.5 px-4 rounded-md text-xs font-bold flex items-center gap-1.5"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Permanently Wipe Database Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
