import { getTranslations } from 'next-intl/server';
import { verifyEmailToken } from '@/actions/email';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { VerifySuccessClient } from './VerifySuccessClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ token?: string; email?: string }>;
}

const CARD_WRAPPER = "min-h-screen flex items-center justify-center bg-gray-50 px-4";
const CARD_INNER   = "max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center shadow-2xl border border-gray-100";

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token, email } = await searchParams;
  const t = await getTranslations('Auth');

  // No token / email → bad link entry
  if (!token || !email) {
    return (
      <main className={CARD_WRAPPER}>
        <div className={CARD_INNER}>
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8" aria-hidden="true">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4">{t('emailVerifiedError')}</h1>
          <p className="text-gray-500 font-medium mb-10 leading-relaxed">
            {t('verifyEmailMissingParams')}
          </p>
          <Link href="/login">
            <Button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
              {t('goToLogin')}
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const result = await verifyEmailToken(token, email);

  if (result.success) {
    return (
      <main className={CARD_WRAPPER}>
        <VerifySuccessClient />
        <div className={CARD_INNER}>
          <div
            className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce motion-reduce:animate-none"
            aria-hidden="true"
          >
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4">{t('emailVerifiedSuccess')}</h1>
          <p className="text-gray-500 font-medium mb-10 leading-relaxed">
            {t('verifyEmailSuccessBody')}
          </p>
          <Link href="/dashboard">
            <Button className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2">
              <div className="flex items-center justify-center gap-2">
                {t('goToDashboard')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform motion-reduce:transition-none" aria-hidden="true" />
              </div>
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  // Failure path
  return (
    <main className={CARD_WRAPPER}>
      <div className={CARD_INNER}>
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8" aria-hidden="true">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4">{t('emailVerifiedError')}</h1>
        <p className="text-gray-500 font-medium mb-10 leading-relaxed">
          {result.error?.message || t('verifyEmailFailedBody')}
        </p>
        <Link href="/profile">
          <Button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
            {t('tryAgain')}
          </Button>
        </Link>
      </div>
    </main>
  );
}
