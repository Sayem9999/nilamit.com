'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, Upload, Loader2 } from 'lucide-react';
import { raiseDispute } from '@/actions/dispute';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface DisputeModalProps {
  transactionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function DisputeModal({ transactionId, isOpen, onClose }: DisputeModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (reason.length < 10) {
      toast.error('Please provide a more detailed reason (min 10 chars).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await raiseDispute(transactionId, reason);
      if (res.success) {
        toast.success('Dispute raised successfully. An admin will review it shortly.');
        router.refresh();
        onClose();
      } else {
        toast.error(res.error?.message || 'Failed to raise dispute');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[2rem] shadow-2xl z-[101] p-8 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-bold text-gray-900 leading-tight">
                  Raise Dispute
                </Dialog.Title>
                <Dialog.Description className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                  Escrow Protection
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Raising a dispute will freeze the escrow funds. Both parties will be contacted for evidence. False disputes may result in account suspension.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Reason for Dispute
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the issue in detail (e.g., item not as described, shipping delay, etc.)"
                className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm resize-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || reason.length < 10}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                Confirm Dispute
              </button>
              
              <Dialog.Close asChild>
                <button className="w-full py-4 text-gray-500 hover:text-gray-700 font-bold text-sm transition-all">
                  Cancel
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
