'use client';

import { useEffect, useState, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { applyActionCode } from 'firebase/auth';
import { getClientAuth, ensureFirebaseAuth } from '@/lib/firebase-client';
import { markEmailVerifiedNatively } from '@/actions/email';
import { Gavel, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

function AuthActionHandler() {
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  // Derive initial status and error statically to satisfy strict react-hooks/set-state-in-effect rules
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
    if (!mode || !oobCode || mode !== 'verifyEmail') {
      return 'error';
    }
    return 'loading';
  });

  const [errorMsg, setErrorMsg] = useState<string>(() => {
    if (!mode || !oobCode) {
      return 'This verification link is missing details. Open the link from your email — that one will work.';
    }
    if (mode !== 'verifyEmail') {
      return 'This action is not supported natively. Please use Nilamit\'s account settings or recovery pages.';
    }
    return '';
  });

  const [, startTransition] = useTransition();

  useEffect(() => {
    // If we've already derived an error state statically, do nothing
    if (!mode || !oobCode || mode !== 'verifyEmail') {
      return;
    }

    const verifyEmail = async () => {
      try {
        await ensureFirebaseAuth();
        const auth = getClientAuth();
        
        // Apply the email verification code client-side
        await applyActionCode(auth, oobCode);

        // Force reload user record to update state
        if (auth.currentUser) {
          await auth.currentUser.reload();
        }

        // Best-effort sync verification status to Firestore if user is signed in
        startTransition(async () => {
          try {
            const res = await markEmailVerifiedNatively();
            if (res.success) {
              setStatus('success');
            } else {
              // If unauthorized (user verified on another device/logged out),
              // the verification is still successful in Firebase Auth!
              setStatus('success');
            }
          } catch {
            setStatus('success');
          }
        });

      } catch (err) {
        console.error('[Auth Action] Verification failed:', err);
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : t('verifyEmailFailedBody'));
      }
    };

    verifyEmail();
  }, [mode, oobCode, t]);

  // Adjust default warning text to use translation keys dynamically if they load successfully
  const resolvedErrorMsg = errorMsg === 'This verification link is missing details. Open the link from your email — that one will work.'
    ? t('verifyEmailMissingParams')
    : errorMsg;

  const CARD_INNER = "max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center shadow-md border border-gray-100 relative overflow-hidden";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
      {/* Dynamic abstract background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[50%] rounded-full bg-primary-500/5 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={CARD_INNER}
      >
        {/* Authoritative Circular Logo Badge (Primary Brand Alignment) */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-full">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-md shadow-primary-500/20 transform hover:scale-105 transition-all duration-300" aria-hidden="true">
              <Gavel className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900 tracking-tight">
              nilam<span className="text-primary-600">it</span>
            </span>
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6 py-6"
            >
              <div className="w-20 h-20 bg-primary-50 rounded-md flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Verifying Link</h1>
              <p className="text-gray-500 font-medium leading-relaxed">
                Applying cryptographic validation code to secure your connection...
              </p>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="w-20 h-20 bg-green-50 rounded-md flex items-center justify-center mx-auto mb-4 animate-bounce duration-1000" aria-hidden="true">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {t('emailVerifiedSuccess')}
              </h1>
              <p className="text-gray-500 font-medium leading-relaxed">
                {t('verifyEmailSuccessBody')}
              </p>
              <Link href="/dashboard" className="block pt-4">
                <button className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-lg shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                  {t('goToDashboard')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="w-20 h-20 bg-red-50 rounded-md flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {t('emailVerifiedError')}
              </h1>
              <p className="text-gray-500 font-medium leading-relaxed">
                {resolvedErrorMsg}
              </p>
              <div className="flex gap-4 pt-4">
                <Link href="/profile" className="flex-1">
                  <button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-md font-bold text-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
                    {t('tryAgain')}
                  </button>
                </Link>
                <Link href="/" className="flex-1">
                  <button className="w-full h-14 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md font-bold text-md border border-gray-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300">
                    Home
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    }>
      <AuthActionHandler />
    </Suspense>
  );
}
