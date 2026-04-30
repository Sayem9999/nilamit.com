'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, AlertCircle, Download, FileText } from 'lucide-react';
import { adminWipeTestData, exportTransactionsCSV } from '@/actions/admin-system';

export function SystemTab() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleWipe = async () => {
    setIsPending(true);
    try {
      const result = await adminWipeTestData();
      if (result.success) {
        setStatus('success');
        setMessage(result.data?.message || 'Success');
      } else {
        setStatus('error');
        setMessage(result.error?.message || 'Failed to wipe data');
      }
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Unknown error');
    } finally {
        setIsPending(false);
        setIsConfirmOpen(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportTransactionsCSV();
      if (result.success && result.data?.data) {
        const blob = new Blob([result.data.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nilamit-transactions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert(result.error?.message || 'Export failed');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-primary-50 p-3 rounded-xl">
            <FileText className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Reports & Exports</h3>
            <p className="text-sm text-gray-500 mt-1">
              Generate and download data for auditing and accounting.
            </p>

            <div className="mt-6 border-t border-gray-50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Transaction Report (CSV)</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Downloads all closed auctions, final prices, winner details, and calculated commissions.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-gray-200 shadow-sm"
                >
                  {isExporting ? (
                    <span className="animate-spin w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? 'Generating...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-red-50 p-3 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Danger Zone</h3>
            <p className="text-sm text-gray-500 mt-1">
              Destructive actions that cannot be undone. Proceed with caution.
            </p>

            <div className="mt-6 border-t border-red-50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Wipe All Test Data</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Permanently deletes ALL auctions, bids, and related images. User accounts are preserved.
                  </p>
                </div>
                <button
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={isPending}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Wipe Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Toasts */}
      {status === 'success' && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-2 border border-green-200">
            <AlertCircle className="w-5 h-5" /> {message}
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-red-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-bold">Confirm Data Wipe</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you absolutely sure? This will delete <strong>ALL</strong> auctions, bids, and reports. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                {isPending ? 'Wiping...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
