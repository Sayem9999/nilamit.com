/**
 * auth.config.ts — Edge-compatible NextAuth configuration
 *
 * This file must NOT import Prisma, pg, bcryptjs, or any Node.js-only modules.
 * It is used in:
 *   - src/middleware.ts  (Edge Runtime)
 *   - src/lib/auth.ts   (spread into full config)
 */

import type { NextAuthConfig } from 'next-auth';

// Pages that require an authenticated session
const PROTECTED_PATHS = [
  '/dashboard',
  '/profile',
  '/auctions/create',
  '/admin',
  '/seller/inventory',
  '/seller/performance',
];

export const authConfig: NextAuthConfig = {
  basePath: '/api/auth',
  // JWT strategy — no DB needed for session reads; works on Edge + Cloud Run
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  // Providers are registered in auth.ts; this file is kept Node-free for Edge
  providers: [],

  callbacks: {
    /**
     * authorized() — called by middleware on every request.
     * Return true to allow, Response.redirect() to redirect, false for 401.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Strip locale prefix (e.g. /en, /bn) before matching
      const path = pathname.replace(/^\/(en|bn)/, '') || '/';

      const isProtected = PROTECTED_PATHS.some(p => path.startsWith(p));

      if (isProtected && !isLoggedIn) {
        const locale = pathname.match(/^\/(en|bn)/)?.[1] ?? 'en';
        const loginUrl = new URL(`/${locale}/login`, nextUrl);
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
};
