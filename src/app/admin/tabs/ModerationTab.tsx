'use client';

import { useState, useEffect, useTransition } from 'react';
import { getAdminReports, resolveReport, suspendAuction } from '@/actions/admin-moderation';
import { AlertCircle, CheckCircle, XCircle, ExternalLink, ShieldAlert, Ban, EyeOff } from 'lucide-react';
import Link from 'next/link';

export function ModerationTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'PENDING' | 'RESOLVED'>('PENDING');

  const fetchReports = async () => {
    setLoading(true);
    const res = await getAdminReports(filter);
    if (res.success) {
      setReports(res.reports || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const handleDismiss = (id: string) => {
    if (!confirm('Dismiss this report?')) return;
    startTransition(async () => {
      await resolveReport(id, 'DISMISSED');
      fetchReports();
    });
  };

  const handleSuspend = (auctionId: string, reportId: string) => {
    if (!confirm('Are you sure you want to suspend this auction? This cannot be undone easily.')) return;
    startTransition(async () => {
      await suspendAuction(auctionId, reportId);
      fetchReports();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold text-gray-900">Moderation Queue</h2>
          <p className="text-sm text-gray-500">Review and action user reports.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'PENDING' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'RESOLVED' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Resolved
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">All Clear!</h3>
          <p className="text-gray-500">No {filter.toLowerCase()} reports found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6">
              {/* Image Preview */}
              <div className="w-full md:w-48 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                {report.auction.images[0] ? (
                  <img src={report.auction.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                )}
                <div className={`absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-bold uppercase ${report.auction.status === 'ACTIVE' ? 'bg-green-500 text-white' : 'bg-gray-800 text-white'}`}>
                  {report.auction.status}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Link href={`/auctions/${report.auction.id}`} target="_blank" className="font-heading font-semibold text-lg hover:underline flex items-center gap-1">
                      {report.auction.title}
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </Link>
                    <p className="text-xs text-gray-500">
                      Seller: <span className="font-medium text-gray-700">{report.auction.seller.name}</span> • 
                      Reporter: <span className="font-medium text-gray-700">{report.reporter.name}</span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="bg-red-50 text-red-800 p-3 rounded-lg text-sm mb-4">
                  <strong className="block text-xs uppercase tracking-wide opacity-70 mb-1">Reason: {report.reason}</strong>
                  {report.description || 'No description provided.'}
                </div>

                {filter === 'PENDING' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDismiss(report.id)}
                      disabled={isPending}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Dismiss Report
                    </button>
                    <button
                      onClick={() => handleSuspend(report.auction.id, report.id)}
                      disabled={isPending || report.auction.status !== 'ACTIVE'}
                      className="px-4 py-2 bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center gap-2"
                    >
                      <Ban className="w-4 h-4" /> Suspend Auction
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
