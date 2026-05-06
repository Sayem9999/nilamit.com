import {getRequestConfig} from 'next-intl/server';
import enMessages from '../messages/en.json';

export const locales = ['en'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  return {
    locale: 'en',
    messages: enMessages
  };
});
