'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, CheckCircle2, X, Copy, ShieldCheck } from 'lucide-react';

interface MfsPaymentModalProps {
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  /** Called with the buyer-entered MFS Transaction ID once they confirm payment. */
  onSuccess: (providerRef: string) => void;
  provider: 'bkash' | 'nagad';
  merchantNumber?: string | null;
}

/**
 * Manual MFS (bKash / Nagad) payment submission.
 *
 * Nilamit does not auto-charge cards. The buyer sends money to the merchant
 * number from their own MFS app, then submits the real Transaction ID (TrxID)
 * here. The escrow moves to VERIFICATION_PENDING and an admin confirms the
 * payment before it becomes HELD. This modal therefore collects a *real* ref —
 * it must never fabricate one or claim a payment succeeded automatically.
 */
export function MfsPaymentModal({ amount, isOpen, onClose, onSuccess, provider, merchantNumber }: MfsPaymentModalProps) {
  const [step, setStep] = useState<'details' | 'submitted'>('details');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [hasConsented, setHasConsented] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset the form whenever the modal closes so the next open starts clean.
      // These synchronous resets only run on the open→closed transition.
      /* eslint-disable react-hooks/set-state-in-effect */
      setStep('details');
      setPhoneNumber('');
      setTrxId('');
      setHasConsented(false);
      setCopied(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  const trxValid = /^[A-Za-z0-9]{6,20}$/.test(trxId.trim());
  const phoneValid = phoneNumber.trim().length >= 11;
  const canSubmit = trxValid && phoneValid && hasConsented;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setStep('submitted');
    // Pass the REAL transaction id through; the server records it as the
    // providerRef and an admin verifies it before releasing escrow.
    onSuccess(trxId.trim().toUpperCase());
  };

  const handleCopy = async () => {
    if (!merchantNumber) return;
    try {
      await navigator.clipboard.writeText(merchantNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const colors = {
    bkash: { primary: 'bg-[#D12053]', hover: 'hover:bg-[#B01A45]', ring: 'focus:border-[#D12053]' },
    nagad: { primary: 'bg-[#F7941D]', hover: 'hover:bg-[#D67C12]', ring: 'focus:border-[#F7941D]' },
  }[provider];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-md shadow-xl overflow-hidden max-w-md w-full relative"
          >
            <div className={`${colors.primary} p-6 flex items-center justify-between text-white`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-md">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg tracking-tight uppercase">{provider} Payment</h3>
                  <p className="text-[11px] font-bold opacity-80 uppercase tracking-wide">Manual advance payment</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              {step === 'details' && (
                <div className="space-y-5">
                  <div className="text-center">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Amount to send</p>
                    <h2 className="text-4xl font-bold text-gray-900">৳{amount.toLocaleString()}</h2>
                  </div>

                  <ol className="text-xs text-gray-600 space-y-2 bg-gray-50 border border-gray-100 rounded-md p-4 list-decimal list-inside">
                    <li>Open your {provider} app and choose <strong>Send Money</strong>.</li>
                    <li>Send <strong>৳{amount.toLocaleString()}</strong> to the merchant number below.</li>
                    <li>Copy the <strong>Transaction ID (TrxID)</strong> from the confirmation SMS and paste it here.</li>
                  </ol>

                  <div className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-md border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Merchant number</p>
                      <p className="font-mono font-bold text-gray-900 truncate">{merchantNumber || 'Not configured — contact support'}</p>
                    </div>
                    {merchantNumber && (
                      <button onClick={handleCopy} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100">
                        <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Your {provider} number</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="01XXXXXXXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className={`mt-2 w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-md outline-none transition-all font-semibold ${colors.ring}`}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Transaction ID (TrxID)</span>
                    <input
                      type="text"
                      placeholder="e.g. 9H7A2K4L8P"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      className={`mt-2 w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-md outline-none transition-all font-mono font-semibold uppercase ${colors.ring}`}
                    />
                    {trxId.length > 0 && !trxValid && (
                      <span className="text-[11px] text-red-500 ml-1">Enter the 6–20 character TrxID from your SMS.</span>
                    )}
                  </label>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                    <input
                      type="checkbox"
                      id="policy-consent"
                      checked={hasConsented}
                      onChange={(e) => setHasConsented(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300"
                    />
                    <label htmlFor="policy-consent" className="text-[11px] text-gray-500 leading-snug">
                      I confirm I have sent the payment and the TrxID above is correct. I agree to the{' '}
                      <a href="/policy" target="_blank" className="text-gray-900 font-bold underline">Trust &amp; Safety Policy</a>.
                    </label>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-3.5 ${colors.primary} ${colors.hover} text-white rounded-md font-bold text-base active:scale-[0.99] transition-all disabled:opacity-50`}
                  >
                    Submit for verification
                  </button>
                </div>
              )}

              {step === 'submitted' && (
                <div className="py-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold text-gray-900 mb-2">Submitted!</h3>
                  <p className="text-sm text-gray-600 max-w-[280px]">
                    Your payment reference is recorded. An admin will verify and secure it shortly — you&apos;ll be notified.
                  </p>
                  <div className="mt-5 flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4" /> Held securely until you confirm delivery
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
