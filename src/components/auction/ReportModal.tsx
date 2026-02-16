'use client';

import { useState } from 'react';
import { Flag, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { reportAuction } from '@/actions/report';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportModalProps {
  auctionId: string;
}

const REASONS = [
  'Prohibited items',
  'Incorrect category',
  'Suspicious or fraudulent',
  'Misleading description',
  'Offensive content',
  'Contact info in description',
  'Other'
];

export function ReportModal({ auctionId }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await reportAuction(auctionId, reason, description);
      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setIsSuccess(false);
          setReason('');
          setDescription('');
        }, 2000);
      } else {
        setError(res.error || 'Failed to submit report');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors py-2"
      >
        <Flag className="w-3.5 h-3.5" />
        Report this auction
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-red-500" />
                  <h3 className="font-heading font-semibold text-gray-900 text-sm">Report Auction</h3>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                {isSuccess ? (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-gray-900 mb-1 text-sm">Report Submitted</p>
                    <p className="text-xs text-gray-500">Thank you for helping keep Nilamit safe.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                        Reason for report
                      </label>
                      <select
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      >
                        <option value="">Select a reason...</option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                        Additional details (Optional)
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell us more about why you are reporting this..."
                        className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none transition-all"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <p>{error}</p>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting || !reason}
                        className="w-full h-11 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/10"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
