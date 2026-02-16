'use client';

import { useState, useTransition, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { updateProfile } from '@/actions/user';
import { sendPhoneOTP, verifyPhoneOTP } from '@/actions/phone';
import { User, Phone, Shield, CheckCircle, Edit3, Save } from 'lucide-react';

export default function ProfilePage() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'input' | 'otp'>('idle');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session]);

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>;
  }

  if (!session) {
    return null;
  }

  const user = session.user as Record<string, unknown>;
  const isPhoneVerified = user?.isPhoneVerified as boolean;

  const handleSaveName = () => {
    startTransition(async () => {
      await updateProfile({ name });
      await update();
      setEditing(false);
    });
  };

  const handleSendOTP = () => {
    setMsg('');
    startTransition(async () => {
      const res = await sendPhoneOTP(phone);
      if (res.success) { setPhoneStep('otp'); setMsg('OTP sent! Check your phone.'); }
      else setMsg(res.error || 'Failed to send OTP.');
    });
  };

  const handleVerifyOTP = () => {
    setMsg('');
    startTransition(async () => {
      const res = await verifyPhoneOTP(phone, otp);
      if (res.success) { setPhoneStep('idle'); setMsg('Phone verified!'); await update(); }
      else setMsg(res.error || 'Verification failed.');
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading font-bold text-2xl text-gray-900 mb-6">Profile</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            {session.user?.image ? (
              <img src={session.user.image} alt="" className="w-16 h-16 rounded-full" />
            ) : (
              <User className="w-8 h-8 text-primary-600" />
            )}
          </div>
          <div>
            <p className="font-heading font-semibold text-lg text-gray-900">{session.user?.name}</p>
            <p className="text-sm text-gray-500">{session.user?.email}</p>
          </div>
        </div>

        {/* Name Edit */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Display Name</label>
          {editing ? (
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              <button onClick={handleSaveName} disabled={isPending}
                className="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 flex items-center gap-1">
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{session.user?.name || 'Not set'}</span>
              <button onClick={() => setEditing(true)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>
          )}
        </div>

        {/* Reputation */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Reputation Score</label>
          <span className="text-sm text-gray-700">{(user?.reputationScore as number) || 0} points</span>
        </div>
      </div>

      {/* Phone Verification */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-heading font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary-600" /> Phone Verification
        </h2>

        {isPhoneVerified ? (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Phone verified: <strong>{user?.phone as string}</strong></span>
          </div>
        ) : phoneStep === 'idle' ? (
          <div>
            <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Verify your Bangladesh phone number (+880) to bid or sell on nilamit.com</span>
            </div>
            <button onClick={() => setPhoneStep('input')}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
              Verify Phone Number
            </button>
          </div>
        ) : phoneStep === 'input' ? (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Bangladesh Phone Number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:ring-2 focus:ring-primary-500 outline-none" />
            <button onClick={handleSendOTP} disabled={isPending || phone.length < 14}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
              {isPending ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">Enter the 6-digit code sent to <strong>{phone}</strong></p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono mb-3 focus:ring-2 focus:ring-primary-500 outline-none" />
            <button onClick={handleVerifyOTP} disabled={isPending || otp.length !== 6}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold px-5 py-2.5 rounded-xl text-sm w-full">
              {isPending ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        )}

        {msg && <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.includes('verified') || msg.includes('sent') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}
      </div>
    </div>
  );
}
