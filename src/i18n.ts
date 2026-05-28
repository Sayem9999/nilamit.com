import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';
import enMessages from '../messages/en.json';
import bnMessages from '../messages/bn.json';

export const locales = ['en', 'bn'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const messagesByLocale: Record<Locale, Record<string, unknown>> = {
  en: enMessages,
  bn: bnMessages,
};

function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'bn';
}

/**
 * Cookie-driven locale selection. We don't prefix URLs because the original
 * deployment was English-only and the existing route table (/auctions, /dashboard,
 * etc.) is canonical for SEO. Add a header- or geo-based default if needed.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
