"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
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
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-650" />
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-amber-50 border border-amber-200 text-amber-600">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
      case "RESOLVED_CLOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-emerald-50 border border-emerald-200 text-emerald-600">
            <CheckCircle className="w-3 h-3" /> Resolved & Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pt-36 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg shadow-primary-500/10 shrink-0">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3 font-heading">
                  Dispute Center
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Manage active buyer claims, submit transit tracking proof, and resolve escrow blocks.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dispute Summary Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-slate-100 shadow-sm p-6 rounded-[1.5rem] flex items-center gap-4">
            <div className="p-3 bg-amber-50 border border-amber-100 text-amber-500 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Active Claims</p>
              <p className="text-2xl font-black text-slate-900 font-heading">
                {disputes.filter((d) => d.status === "UNDER_INVESTIGATION").length}
              </p>
            </div>
          </div>
          <div className="bg-white border border-slate-100 shadow-sm p-6 rounded-[1.5rem] flex items-center gap-4">
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Resolved Cases</p>
              <p className="text-2xl font-black text-slate-900 font-heading">
                {disputes.filter((d) => d.status === "RESOLVED_CLOSED").length}
              </p>
            </div>
          </div>
        </section>

        {/* Disputes List Container */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-[2rem] overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
            <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 font-heading">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Active Cases & Escalations ({disputes.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                  <th className="px-6 py-4">Case ID & Date</th>
                  <th className="px-6 py-4">Item Details</th>
                  <th className="px-6 py-4">Buyer & Claim Reason</th>
                  <th className="px-6 py-4">Escrow held</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium">
                {disputes.map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-100 text-slate-700">
                    <td className="px-6 py-4">
                      <p className="font-mono text-slate-900 font-bold">{caseItem.id}</p>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(caseItem.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[220px]">
                      <p className="text-slate-900 font-bold truncate" title={caseItem.auctionTitle}>
                        {caseItem.auctionTitle}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-900 font-bold">{caseItem.buyer}</p>
                      <span className="text-[10px] text-amber-600 mt-1 block font-bold">
                        {caseItem.reason}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-red-600">{formatBDT(caseItem.amount)}</span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(caseItem.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {caseItem.status !== "RESOLVED_CLOSED" && (
                          <button
                            onClick={() => handleResolveDispute(caseItem.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md shadow-emerald-600/10 hover:shadow-lg"
                            title="Resolve Case / Refund Buyer"
                          >
                            <Scale className="w-3.5 h-3.5" /> Resolve Claim
                          </button>
                        )}
                        <Link
                          href="/dashboard?tab=coordination"
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200/50 rounded-lg transition-colors"
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
