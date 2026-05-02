'use client';

import { useState, useEffect } from 'react';
import { getTreasuryAudit, getAdminActiveEscrows, resolveAdminDispute, getVerificationQueue, approveEscrowPayment } from '@/actions/admin';
import { ShieldCheck, Download, ExternalLink, Smartphone, Clock, Scale, RotateCcw, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import { formatBDT } from '@/lib/format';
import { generateInvoice } from '@/lib/pdf-generator';
import toast from 'react-hot-toast';

interface TreasuryLog {
  id: string;
  amount: number;
  verificationType: string;
  providerRef: string | null;
  status: string;
  auction: { 
    title: string;
    seller: { name: string | null; phone: string | null };
  };
  buyer: { name: string | null; email: string | null; phone: string | null };
}

interface ActiveEscrow {
  id: string;
  amount: number;
  createdAt: Date;
  auction: { id: string; title: string; seller: { name: string | null } };
  buyer: { name: string | null };
}

export function TreasuryTab() {
  const [logs, setLogs] = useState<TreasuryLog[]>([]);
  const [activeEscrows, setActiveEscrows] = useState<ActiveEscrow[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<TreasuryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [auditRes, escrowRes, queueRes] = await Promise.all([
        getTreasuryAudit(),
        getAdminActiveEscrows(),
        getVerificationQueue()
      ]);
      if (auditRes.success && auditRes.data) {
        setLogs(auditRes.data as TreasuryLog[]);
      } else if (!auditRes.success) {
        toast.error(auditRes.error?.message || "Failed to load treasury audit");
      }

      if (escrowRes.success && escrowRes.data) {
        setActiveEscrows(escrowRes.data as ActiveEscrow[]);
      }

      if (queueRes.success && queueRes.data) {
        setVerificationQueue(queueRes.data as TreasuryLog[]);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to load treasury data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProtectedRefund = async (id: string) => {
    if (!confirm('Refund buyer but DEDUCT 120 BDT for seller shipping?')) return;
    setResolving(id);
    // In a real app, this would call a server action that wraps CommitmentService.refundWithLogisticsDeduction
    toast.success('Deduction-based refund processed (Simulation)');
    setResolving(null);
  };

  const handleManualResolve = async (id: string, resolution: 'RELEASE' | 'REFUND') => {
    if (!confirm(`Are you sure you want to FORCE ${resolution} this escrow?`)) return;
    setResolving(id);
    try {
      const res = await resolveAdminDispute(id, resolution);
      if (res.success) {
        toast.success(`Escrow ${resolution.toLowerCase()}ed successfully`);
        setActiveEscrows(prev => prev.filter(e => e.id !== id));
      } else {
        toast.error(res.error?.message || "Resolution failed");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Resolution failed");
    } finally {
      setResolving(null);
    }
  };

  const handleApprovePayment = async (id: string) => {
    if (!confirm('Confirm you have manually verified this MFS transaction?')) return;
    setApproving(id);
    try {
      const res = await approveEscrowPayment(id);
      if (res.success) {
        toast.success('Payment verified successfully');
        setVerificationQueue(prev => prev.filter(p => p.id !== id));
        loadData(); // Refresh everything
      } else {
        toast.error(res.error?.message || 'Verification failed');
      }
    } catch (e) {
      toast.error('An error occurred');
    } finally {
      setApproving(null);
    }
  };

  const handleDownloadInvoice = (log: TreasuryLog) => {
    try {
      const doc = generateInvoice({
        invoiceNumber: log.id.slice(-8).toUpperCase(),
        date: new Date(),
        auctionTitle: log.auction.title,
        amount: log.amount,
        buyerName: log.buyer.name || "Valued Buyer",
        buyerPhone: log.buyer.phone || "N/A",
        sellerName: log.auction.seller?.name || "Verified Seller",
        sellerPhone: log.auction.seller?.phone || "N/A"
      });
      doc.save(`invoice-${log.id.slice(-8)}.pdf`);
      toast.success("Invoice generated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate invoice");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            Treasury Audit Hub
          </h3>
          <p className="text-sm text-gray-500">Real-time oversight of automated MFS escrow transactions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-gray-200">
           <Download className="w-4 h-4" /> Export Ledger
        </button>
      </div>

      {/* Verification Queue Section */}
      {verificationQueue.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 mb-8">
           <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4" /> 
                Verification Queue ({verificationQueue.length})
              </h4>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {verificationQueue.map((item) => (
                <div key={item.id} className="bg-white border border-amber-200/50 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                   <div className="flex-1">
                      <p className="text-[9px] font-black text-amber-600 uppercase mb-1">Pending #{item.id.slice(-6)}</p>
                      <h5 className="font-bold text-gray-900 text-sm truncate">{item.auction.title}</h5>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        <span className="font-bold">{item.buyer.name}</span> | {item.providerRef || 'No Reference'}
                      </p>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-gray-900 mb-2">{formatBDT(item.amount)}</p>
                      <button 
                        onClick={() => handleApprovePayment(item.id)}
                        disabled={!!approving}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-lg shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
                      >
                        {approving === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {loading ? (
        <div className="p-20 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-emerald-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Transaction ID</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Buyer</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Verification</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">No automated transactions recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-emerald-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-900 font-mono">#{log.id.slice(-6)}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[150px]">{log.auction.title}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{log.buyer.name || 'Anonymous'}</p>
                      <p className="text-[10px] text-gray-500">{log.buyer.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-gray-900">{formatBDT(log.amount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border ${
                        log.status === 'VERIFICATION_PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        log.verificationType === 'AUTOMATIC' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {log.status === 'VERIFICATION_PENDING' ? <Clock className="w-3 h-3" /> :
                         log.verificationType === 'AUTOMATIC' ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {log.status === 'VERIFICATION_PENDING' ? 'Pending' : (log.verificationType || 'Manual')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleDownloadInvoice(log)}
                          className="p-2 text-gray-400 hover:text-primary-600 transition"
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {log.providerRef && (
                           <ExternalLink className="w-3 h-3 text-gray-300 cursor-pointer hover:text-emerald-500" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Intelligence Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-600 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-500/20">
             <Smartphone className="w-8 h-8 opacity-50 mb-4" />
             <h4 className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1 text-emerald-100">Treasury Velocity</h4>
             <p className="text-3xl font-black">{logs.length} <span className="text-xs font-bold uppercase opacity-50 tracking-tighter">Verified</span></p>
          </div>
          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
             <ShieldCheck className="w-8 h-8 text-blue-600 opacity-50 mb-4" />
             <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Protection Coverage</h4>
             <p className="text-3xl font-black text-gray-900">100% <span className="text-xs font-bold uppercase text-blue-600 tracking-tighter">Automated</span></p>
          </div>
          <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
             <Clock className="w-8 h-8 text-amber-600 opacity-50 mb-4" />
             <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Avg. Verification</h4>
             <p className="text-3xl font-black text-gray-900">2.4s <span className="text-xs font-bold uppercase text-amber-600 tracking-tighter">Response</span></p>
          </div>
      </div>

      {/* Active Escrow Resolution Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Active Escrow Control (HELD Status)</h4>
            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded uppercase">Manual Override</span>
        </div>
        
        {activeEscrows.length === 0 ? (
            <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-3xl p-8 text-center">
                <p className="text-sm text-gray-400 italic">No funds currently held in escrow.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {activeEscrows.map((escrow) => (
                    <div key={escrow.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">ID: {escrow.id.slice(-8)}</p>
                            <h5 className="font-bold text-gray-900 truncate">{escrow.auction.title}</h5>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-500">Seller: <span className="font-bold">{escrow.auction.seller.name || 'Unknown'}</span></span>
                                <span className="text-[10px] text-gray-300">|</span>
                                <span className="text-[10px] text-gray-500">Buyer: <span className="font-bold">{escrow.buyer.name || 'Unknown'}</span></span>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className="text-lg font-black text-emerald-600 mb-2">{formatBDT(escrow.amount)}</p>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleManualResolve(escrow.id, 'RELEASE')}
                                    disabled={!!resolving}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors title='Release to Seller'"
                                >
                                    <Scale className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleProtectedRefund(escrow.id)}
                                    disabled={!!resolving}
                                    className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                                    title="Refund - 120 BDT Shipping"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleManualResolve(escrow.id, 'REFUND')}
                                    disabled={!!resolving}
                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                    title="Full Refund"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
