'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, CheckCircle2, X, CreditCard, Shield } from 'lucide-react';

interface MockPaymentGatewayProps {
  amount: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (providerRef: string) => void;
  provider: 'bkash' | 'nagad';
  merchantNumber?: string | null;
}

export function MockPaymentGateway({ amount, isOpen, onClose, onSuccess, provider, merchantNumber }: MockPaymentGatewayProps) {
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReceiptRef(`PG-${Math.random().toString(36).substr(2, 12).toUpperCase()}`);
  }, []);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep('details');
       
      setPhoneNumber('');
      setHasConsented(false);
    }
  }, [isOpen]);

  const handlePay = () => {
    if (phoneNumber.length < 11 || !hasConsented) return;
    setStep('processing');
    
    // Simulate Gateway Logic (2 seconds)
    setTimeout(() => {
      setStep('success');
      // Simulate Final Success (1 second)
      setTimeout(() => {
        const mockRef = `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        onSuccess(mockRef);
      }, 1500);
    }, 2000);
  };

  const colors = {
    bkash: { primary: 'bg-[#D12053]', secondary: 'text-[#D12053]', hover: 'hover:bg-[#B01A45]' },
    nagad: { primary: 'bg-[#F7941D]', secondary: 'text-[#F7941D]', hover: 'hover:bg-[#D67C12]' },
  };

  const currentColors = colors[provider];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-w-md w-full relative"
          >
            {/* Header */}
            <div className={`${currentColors.primary} p-6 flex items-center justify-between text-white`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-lg tracking-tight uppercase">
                    {provider} PG CHECKOUT
                  </h3>
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Secure Automatic Gateway</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                disabled={step === 'processing' || step === 'success'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8">
              {step === 'details' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Payable Amount</p>
                    <h2 className="text-4xl font-black text-gray-900">৳{amount}</h2>
                    <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-tighter">
                      Paying to Merchant: <span className="text-gray-900">{merchantNumber || '01XXXXXXXXX'}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-wider ml-1">Your {provider} Number</span>
                      <div className="mt-2 relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <input
                          type="tel"
                          placeholder="01XXXXXXXXX"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-red-500 focus:outline-none transition-all font-bold text-lg"
                        />
                      </div>
                    </label>

                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <input 
                        type="checkbox" 
                        id="policy-consent"
                        checked={hasConsented}
                        onChange={(e) => setHasConsented(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <label htmlFor="policy-consent" className="text-[10px] text-gray-500 leading-tight">
                        I have read and agree to the <a href="/policy" target="_blank" className="text-gray-900 font-bold underline">Nilamit Trust & Safety Policy</a>. 
                        I understand that rejections without cause may incur a <strong>120 BDT shipping deduction</strong> from my refund.
                      </label>
                    </div>

                    <button
                      onClick={handlePay}
                      disabled={phoneNumber.length < 11 || !hasConsented}
                      className={`w-full py-4 ${currentColors.primary} ${currentColors.hover} text-white rounded-2xl font-black text-lg shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale`}
                    >
                      PAY NOW
                    </button>
                  </div>
                </div>
              )}

              {step === 'processing' && (
                <div className="py-12 flex flex-col items-center text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className={`w-16 h-16 border-4 border-gray-100 border-t-${provider === 'bkash' ? '[#D12053]' : '[#F7941D]'} rounded-full mb-8`}
                  />
                  <h3 className="text-xl font-heading font-black text-gray-900 mb-2">Verifying with {provider}</h3>
                  <p className="text-sm text-gray-500 max-w-[250px]">Please do not close this window or refresh the page.</p>
                </div>
              )}

              {step === 'success' && (
                <div className="py-12 flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-8"
                  >
                    <CheckCircle2 className="w-12 h-12" />
                  </motion.div>
                  <h3 className="text-2xl font-heading font-black text-gray-900 mb-2">Payment Successful!</h3>
                  <p className="text-sm text-emerald-600 font-bold mb-4">Transaction Verified via Automated Proxy</p>
                  <div className="bg-gray-50 p-4 rounded-2xl w-full">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Receipt Reference</p>
                    <p className="font-mono font-bold text-gray-700">{receiptRef}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-8 animate-pulse italic">Automatically redirecting back to Nilamit...</p>
                </div>
              )}
            </div>

            {/* Footer Trust */}
            <div className="border-t border-gray-50 p-4 flex items-center justify-center gap-6 opacity-30 grayscale">
              <div className="flex items-center gap-1.5 grayscale">
                <CreditCard className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-tighter">PCI-DSS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-tighter">SECURE</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
