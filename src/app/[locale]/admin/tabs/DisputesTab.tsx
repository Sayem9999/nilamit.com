"use client";

import { useState, useEffect, useTransition } from "react";
import { getAdminDisputes, resolveAdminDispute } from "@/actions/admin";
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAdminDisputes();
      setDisputes(res as DisputeTransaction[]);
    } catch {
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = (id: string, resolution: 'RELEASE' | 'REFUND') => {
    const actionLabel = resolution === 'RELEASE' ? "Release Funds to Seller" : "Refund Buyer";
    if (!confirm(`Are you sure you want to ${actionLabel.toLowerCase()}? This action is permanent and affects user reputation.`)) return;

    startTransition(async () => {
      try {
        await resolveAdminDispute(id, resolution);
        toast.success(`Dispute resolved: ${actionLabel}`);
        setDisputes(prev => prev.filter(d => d.id !== id));
      } catch (error) {
        toast.error((error as Error).message || "Failed to resolve dispute");
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
          <p className="text-gray-500 font-bn">বর্তমানে কোনো অভিযোগ পেন্ডিং নেই।</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((tx) => (
            <div key={tx.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
               <div className="flex flex-col lg:flex-row justify-between gap-6">
                 <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded tracking-wider">Under Review</span>
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

                    <button
                       onClick={() => handleResolve(tx.id, 'REFUND')}
                       disabled={isPending}
                       className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    >
                       <RefreshCw className="w-4 h-4" /> Full Refund to Buyer
                    </button>

                    {/* TODO: Add link to the coordination chat for admin to review context */}
                    <div className="pt-2">
                       <button className="w-full py-2 text-[10px] text-gray-400 uppercase font-bold border border-dashed border-gray-200 rounded-lg opacity-50 cursor-not-allowed">
                          View Coordination Log (Soon)
                       </button>
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
