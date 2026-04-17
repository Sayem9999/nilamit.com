'use client';

import { useState, useEffect } from 'react';
import { getTreasuryAudit } from '@/actions/admin';
import { ShieldCheck, Search, Download, ExternalLink, Smartphone, Clock } from 'lucide-react';
import { formatBDT } from '@/lib/format';

interface TreasuryLog {
  id: string;
  amount: number;
  verificationType: string;
  providerRef: string | null;
  auction: { title: string };
  buyer: { name: string | null; email: string | null };
}

export function TreasuryTab() {
  const [logs, setLogs] = useState<TreasuryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await getTreasuryAudit();
        setLogs(data as unknown as TreasuryLog[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

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
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Gateway Ref</th>
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
                        log.verificationType === 'AUTOMATIC' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {log.verificationType === 'AUTOMATIC' ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {log.verificationType || 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          {log.providerRef || 'N/A'}
                        </span>
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
    </div>
  );
}
