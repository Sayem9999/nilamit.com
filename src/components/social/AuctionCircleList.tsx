"use client";

import { useState } from "react";
import { createAuctionCircle, joinAuctionCircle } from "@/actions/social";
import { Users, Plus, Key, Loader2, Info } from "lucide-react";
import { toast } from "react-hot-toast";

interface AuctionCircleListProps {
  initialCircles: { id: string; name: string; inviteCode: string; description?: string | null; _count: { members: number; auctions: number } }[];
}

export default function AuctionCircleList({
  initialCircles,
}: AuctionCircleListProps) {
  const [circles] = useState(initialCircles);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode) return;
    setIsLoading(true);
    const res = await joinAuctionCircle(inviteCode);
    setIsLoading(false);

    if (res.success) {
      toast.success("Joined circle successfully!");
      setInviteCode("");
      setIsJoining(false);
      // Refresh list would usually happen via revalidatePath,
      // but for SPA feel we might want internal state update or window.location.reload()
      window.location.reload();
    } else {
      toast.error(res.error || "Failed to join");
    }
  };

  const handleCreate = async () => {
    if (!newName) return;
    setIsLoading(true);
    const res = await createAuctionCircle(newName);
    setIsLoading(false);

    if (res.success) {
      toast.success("Circle created!");
      setNewName("");
      setIsCreating(false);
      window.location.reload();
    } else {
      toast.error(res.error || "Failed to create circle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          Your Circles
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsJoining(true)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-all shadow-sm"
          >
            <Key className="w-4 h-4" /> Join Circle
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Circle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {circles.length === 0 ? (
          <div className="col-span-full py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center px-4">
            <Users className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="font-bold text-gray-900 mb-1">No Active Circles</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Private auctions allow friends and families to bid exclusively.
              Create your first circle to get started.
            </p>
          </div>
        ) : (
          circles.map((circle) => (
            <div
              key={circle.id}
              className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 font-bold">
                  {circle.name[0]}
                </div>
                <div className="px-3 py-1 bg-gray-900 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Invite: {circle.inviteCode}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{circle.name}</h3>
              <p className="text-xs text-gray-500 line-clamp-2 mb-4 h-8">
                {circle.description ||
                  "A private auction circle for exclusive bidding."}
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {circle._count.members} Members
                </span>
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" /> {circle._count.auctions} Auctions
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Join Modal */}
      {isJoining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Join a Circle
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Enter the secret invite code shared with you.
            </p>

            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12XY"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setIsJoining(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={isLoading}
                className="flex-[2] py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Join Circle"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              New Auction Circle
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Start a private community for exclusive bidding.
            </p>

            <div className="space-y-4 mb-6">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Circle Name (e.g. Antiques Collectors)"
                className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="flex-[2] py-3 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Create Circle"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
