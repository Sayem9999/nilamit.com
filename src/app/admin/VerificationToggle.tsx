'use client';

import { useState } from 'react';
import { adminToggleVerification } from '@/actions/admin';
import { Shield, Loader2 } from 'lucide-react';

interface VerificationToggleProps {
  userId: string;
  initialStatus: boolean;
}

export function VerificationToggle({ userId, initialStatus }: VerificationToggleProps) {
  const [isVerified, setIsVerified] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await adminToggleVerification(userId);
      setIsVerified(!isVerified);
    } catch (error) {
      alert('Verification toggle failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
        isVerified 
          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
          : 'bg-gray-50 text-gray-400 border border-transparent grayscale'
      }`}
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Shield className="w-3 h-3" />
      )}
      {isVerified ? 'Verified' : 'Verify'}
    </button>
  );
}
