"use client";

import { useState, useEffect, useTransition } from "react";
import { getAdminDisputes, resolveAdminDispute, getAdminCoordinationLog } from "@/actions/admin";
import { ShieldCheck, AlertTriangle, Scale, RefreshCw, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface DisputeTransaction {
  id: string;
  amount: number;
  status: string;
  createdAt: Date;
  auction: { id: string, title: string, seller: { name: string | null; phone: string | null } };
  buyer: { name: string | null; phone: string | null };
  dispute: { reason: string } | null;
}

export function DisputesTab() {
  const [disputes, setDisputes] = useState<DisputeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  type LogEntry = { id: string; content: string; senderId: string; isSystemMessage: boolean; createdAt: Date; imageUrl?: string | null };
  const [activeLog, setActiveLog] = useState<LogEntry[]>([]);
  const [activeAuctionTitle, setActiveAuctionTitle] = useState("");

  const handleViewLog = async (auctionId: string, title: string) => {
    setLogModalOpen(true);
    setLogLoading(true);
    setActiveAuctionTitle(title);
    try {
      const res = await getAdminCoordinationLog(auctionId);
      if (res.success && res.data) {
        setActiveLog(res.data as LogEntry[]);
      } else {
        toast.error(res.error?.message || "Failed to fetch coordination log.");
      }
    } catch {
      toast.error("Failed to fetch coordination log.");
    } finally {
      setLogLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAdminDisputes();
      if (res.success && res.data) {
        setDisputes(res.data as DisputeTransaction[]);
      } else {
        toast.error(res.error?.message || "Failed to load disputes");
      }
    } catch {
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = (id: string, resolution: 'RELEASE' | 'REFUND' | 'HOLD') => {
    const labels = {
      RELEASE: "Release Funds to Seller",
      REFUND: "Refund Buyer",
      HOLD: "Hold Payment for Investigation"
    };
    const actionLabel = labels[resolution];
    if (!confirm(`Are you sure you want to ${actionLabel.toLowerCase()}?`)) return;

    startTransition(async () => {
      try {
        const res = await resolveAdminDispute(id, resolution);
        if (res.success) {
          toast.success(`Dispute updated: ${actionLabel}`);
          if (resolution !== 'HOLD') {
            setDisputes(prev => prev.filter(d => d.id !== id));
          } else {
            load(); // Reload to show updated status if we keep it in the list
          }
        } else {
          toast.error(res.error?.message || "Failed to update dispute");
        }
      } catch (error) {
        toast.error((error as Error).message || "Failed to update dispute");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-gray-900">Escrow Dispute Center</h2>
          <p className="text-sm text-gray-500">Neutral ground for resolving transaction conflicts.</p>
        </div>
        <button 
           onClick={load}
           disabled={loading}
           className="p-2 text-gray-400 hover:text-primary-600 transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No Active Disputes</h3>
          <p className="text-gray-500">There are currently no pending disputes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((tx) => (
            <div key={tx.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
               <div className="flex flex-col lg:flex-row justify-between gap-6">
                 <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded tracking-wider ${
                         tx.status === 'HELD' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                       }`}>
                         {tx.status === 'HELD' ? 'Under Investigation' : 'Dispute Open'}
                       </span>
                       <span className="text-[10px] text-gray-400 font-mono uppercase">ID: {tx.id.substring(0,8)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{tx.auction.title}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                       <div className="p-3 bg-gray-50 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Buyer (Claimant)</p>
                          <p className="font-semibold text-gray-900">{tx.buyer.name || "Unknown"}</p>
                          <p className="text-xs text-gray-500">{tx.buyer.phone}</p>
                       </div>
                       <div className="p-3 bg-gray-50 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Seller (Recipient)</p>
                          <p className="font-semibold text-gray-900">{tx.auction.seller.name || "Unknown"}</p>
                          <p className="text-xs text-gray-500">{tx.auction.seller.phone}</p>
                       </div>
                    </div>

                    <div className="mt-4 p-4 bg-red-50/50 border border-red-100 rounded-xl">
                       <p className="text-xs font-bold text-red-800 flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-3 h-3" /> Alleged Dispute Reason
                       </p>
                       <p className="text-sm text-red-900 italic font-medium">
                         &quot;{tx.dispute?.reason || "No reason provided."}&quot;
                       </p>
                    </div>
                 </div>

                 <div className="lg:w-64 space-y-3 flex flex-col justify-end">
                    <div className="text-right mb-4">
                       <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">Escrowed Funds</p>
                       <p className="text-2xl font-black text-emerald-600 font-heading">৳{tx.amount}</p>
                    </div>

                    <button
                       onClick={() => handleResolve(tx.id, 'RELEASE')}
                       disabled={isPending}
                       className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                       <Scale className="w-4 h-4" /> Release to Seller
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                         onClick={() => handleResolve(tx.id, 'HOLD')}
                         disabled={isPending || tx.status === 'HELD'}
                         className="py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-[10px] hover:bg-gray-50 transition-all flex items-center justify-center gap-1"
                      >
                         <ShieldCheck className="w-3 h-3" /> Hold
                      </button>
                      <button
                         onClick={() => handleResolve(tx.id, 'REFUND')}
                         disabled={isPending}
                         className="py-3 bg-white border border-gray-200 text-red-600 rounded-xl font-bold text-[10px] hover:bg-red-50 transition-all flex items-center justify-center gap-1"
                      >
                         <RefreshCw className="w-3 h-3" /> Refund
                      </button>
                    </div>

                    <div className="pt-2">
                       <button
                          onClick={() => handleViewLog(tx.auction.id, tx.auction.title)}
                          className="w-full py-2 text-[10px] text-gray-700 uppercase font-bold border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                       >
                          View Coordination Log
                       </button>
                    </div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">Coordination Log</h3>
                <p className="text-xs text-gray-500">{activeAuctionTitle}</p>
              </div>
              <button onClick={() => setLogModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-500 hover:bg-gray-50">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
              {logLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
                </div>
              ) : activeLog.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  No messages found in this coordination hub.
                </div>
              ) : (
                activeLog.map((msg: { id: string, content: string, senderId: string, isSystemMessage: boolean, createdAt: Date, imageUrl?: string | null }) => (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.isSystemMessage ? 'mx-auto text-center' : 'bg-white border border-gray-100 p-3 rounded-2xl shadow-sm'}`}>
                    {msg.isSystemMessage ? (
                      <span className="px-3 py-1 bg-gray-100 text-[10px] font-bold text-gray-500 rounded-full uppercase tracking-widest mx-auto">
                        {msg.content}
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{msg.senderId === 'system' ? 'System' : msg.senderId.substring(0,6)}</span>
                        </div>
                        {msg.imageUrl && (
                          <img src={msg.imageUrl} alt="Attachment" className="max-w-full h-auto rounded-lg mb-2" />
                        )}
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[9px] text-gray-400 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => setLogModalOpen(false)}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
