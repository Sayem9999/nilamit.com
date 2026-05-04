import { getTranslations } from 'next-intl/server';
import { verifyEmailToken } from '@/actions/email';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2, XCircle, Mail, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
}

export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token, email } = await searchParams;
  const t = await getTranslations('Auth');

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center shadow-2xl border border-gray-100">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4">{t('emailVerifiedError')}</h1>
          <p className="text-gray-500 font-medium mb-10 leading-relaxed">
            Missing verification parameters. Please use the link provided in your email.
          </p>
          <Link href={`/${locale}/login`}>
            <Button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg">
              {t('goToLogin')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const result = await verifyEmailToken(token, email);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center shadow-2xl border border-gray-100">
        {result.success ? (
          <>
            <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-4">{t('emailVerifiedSuccess')}</h1>
            <p className="text-gray-500 font-medium mb-10 leading-relaxed">
              Your email has been successfully verified. You can now access all features of Nilamit.
            </p>
            <Link href={`/${locale}/dashboard`}>
              <Button className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg group">
                <div className="flex items-center justify-center gap-2">
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Button>
            </Link>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-4">{t('emailVerifiedError')}</h1>
            <p className="text-gray-500 font-medium mb-10 leading-relaxed">
              {result.error?.message || 'The verification link is invalid or has expired.'}
            </p>
            <Link href={`/${locale}/profile`}>
              <Button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold text-lg">
                Try Again
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
