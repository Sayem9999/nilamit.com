"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Gavel,
  ShieldAlert,
  Clock,
  CheckCircle,
  MessageSquare,
  Scale,
  Loader2,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatBDT } from "@/lib/format";

// Mock data representing dispute cases for this seller
const INITIAL_DISPUTES = [
  {
    id: "dis_381923",
    auctionTitle: "Bose QuietComfort Wireless Headphones",
    buyer: "Mushfiqur Rahim",
    reason: "Damaged box on arrival",
    amount: 28000,
    status: "UNDER_INVESTIGATION",
    createdAt: "2026-05-22T08:30:00Z",
  },
  {
    id: "dis_293847",
    auctionTitle: "Vintage Mechanical Keyboard RGB",
    buyer: "Tamim Iqbal",
    reason: "Delay in shipping carrier transit",
    amount: 6500,
    status: "RESOLVED_CLOSED",
    createdAt: "2026-05-18T12:00:00Z",
  },
];

export default function RetailerDisputesPage() {
  const { data: session } = useSession();
  const [disputes, setDisputes] = useState(INITIAL_DISPUTES);

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const handleResolveDispute = (id: string) => {
    setDisputes((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "RESOLVED_CLOSED" } : d))
    );
    toast.success("Case resolved and closed successfully!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "UNDER_INVESTIGATION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
      case "RESOLVED_CLOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Resolved & Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/retailer/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors focus-visible:outline-none"
          >
            <ArrowLeft className="w-4 h-4" /> Back to command center
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                  Dispute Center
                </h1>
                <p className="text-gray-400 text-sm font-medium mt-1">
                  Manage active buyer claims, submit transit tracking proof, and resolve escrow blocks.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dispute Summary Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-[#141417] border border-white/5 p-6 rounded-[1.5rem] flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Active Claims</p>
              <p className="text-2xl font-black text-white">
                {disputes.filter((d) => d.status === "UNDER_INVESTIGATION").length}
              </p>
            </div>
          </div>
          <div className="bg-[#141417] border border-white/5 p-6 rounded-[1.5rem] flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Resolved Cases</p>
              <p className="text-2xl font-black text-white">
                {disputes.filter((d) => d.status === "RESOLVED_CLOSED").length}
              </p>
            </div>
          </div>
        </section>

        {/* Disputes List Container */}
        <div className="bg-[#141417] border border-white/5 rounded-[2rem] overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Active Cases & Escalations ({disputes.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white/[0.01]">
                  <th className="px-6 py-4">Case ID & Date</th>
                  <th className="px-6 py-4">Item Details</th>
                  <th className="px-6 py-4">Buyer & Claim Reason</th>
                  <th className="px-6 py-4">Escrow held</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium">
                {disputes.map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-mono text-white font-bold">{caseItem.id}</p>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(caseItem.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[220px]">
                      <p className="text-white font-bold truncate" title={caseItem.auctionTitle}>
                        {caseItem.auctionTitle}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-bold">{caseItem.buyer}</p>
                      <span className="text-[10px] text-amber-500/80 mt-1 block">
                        {caseItem.reason}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-red-400">{formatBDT(caseItem.amount)}</span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(caseItem.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {caseItem.status !== "RESOLVED_CLOSED" && (
                          <button
                            onClick={() => handleResolveDispute(caseItem.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                            title="Resolve Case / Refund Buyer"
                          >
                            <Scale className="w-3.5 h-3.5" /> Resolve Claim
                          </button>
                        )}
                        <Link
                          href="/dashboard?tab=coordination"
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
                          title="Contact Buyer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
