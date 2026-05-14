/**
 * auth.config.ts — Edge-compatible NextAuth configuration
 *
 * This file must NOT import Prisma, pg, bcryptjs, or any Node.js-only modules.
 * It is used in:
 *   - src/middleware.ts  (Edge Runtime)
 *   - src/lib/auth.ts   (spread into full config)
 */

import type { NextAuthConfig } from 'next-auth';
import { isSafeRedirectPath } from './url-safety';

// Pages that require an authenticated session
const PROTECTED_PATHS = [
  '/dashboard',
  '/profile',
  '/auctions/create',
  '/admin',
  '/seller/inventory',
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
      const isBanned = auth?.user?.isBanned ?? false;
      const { pathname } = nextUrl;

      // 1. If banned, force them to the /banned page (unless they are already there or logging out)
      if (isBanned && !pathname.includes('/banned') && !pathname.includes('/api/auth')) {
        return Response.redirect(new URL('/banned', nextUrl));
      }

      // Strip legacy /en prefix before matching protected paths. The [locale]
      // folder was removed; the prefix exists only in old bookmarks.
      const path = pathname.replace(/^\/en(?=\/|$)/, '') || '/';

      const isProtected = PROTECTED_PATHS.some(p => path.startsWith(p));

      if (isProtected && !isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        // Only round-trip the original path if it is a safe same-origin path.
        // nextUrl.pathname should always be safe, but we validate so a future
        // change to use nextUrl.href or similar can't introduce an open redirect.
        if (isSafeRedirectPath(nextUrl.pathname)) {
          loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
        }
        return Response.redirect(loginUrl);
      }

      // Redirect authenticated users away from auth pages
      const isAuthPage = ['/login', '/register', '/forgot-password'].includes(path);
      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
};
