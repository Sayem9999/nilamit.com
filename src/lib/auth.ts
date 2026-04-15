import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

import { authConfig } from '@/lib/auth.config';

// Guard: Skip Google provider entirely if credentials are missing
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleProviderEnabled = Boolean(googleClientId && googleClientSecret);

if (!googleProviderEnabled && process.env.NODE_ENV === 'production') {
  console.error('[Auth-WARN] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing — Google OAuth disabled.');
}

// How often to refresh user data from the database (1 hour in ms)
const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: process.env.DATABASE_URL ? PrismaAdapter(prisma) : undefined,
  providers: [
    ...(googleProviderEnabled
      ? [
          Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
            console.warn('[Auth] Rejected: Missing email or password');
            return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          const user = await prisma.user.findUnique({ where: { email } });
          
          if (!user) {
              console.warn(`[Auth] Rejected: User not found for email ${email}`);
              return null; 
          }

          if (!user.password) {
               console.warn(`[Auth] Rejected: User ${email} has no password (OAuth account)`);
               return null;
          }

          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
              console.warn(`[Auth] Rejected: Password mismatch for ${email}`);
              return null;
          }

          console.log(`[Auth] Accepted: Successful login for ${email}`);
          return { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            image: user.image,
            isVerifiedSeller: user.isVerifiedSeller,
            reputationScore: user.reputationScore,
            isPhoneVerified: user.isPhoneVerified,
            emailVerified: user.emailVerified,
            userLevel: user.userLevel,
            winningStreak: user.winningStreak
          };
        } catch (error) {
          console.error('[Auth-FATAL] Database connection failed during authorize:', error);
          return null;
        }
      },
    }),
    Credentials({
      id: 'phone',
      name: 'Phone',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) {
            console.warn('[Auth-Phone] Rejected: Missing phone or password');
            return null;
        }

        const phone = credentials.phone as string;
        const password = credentials.password as string;

        try {
          const user = await prisma.user.findUnique({ where: { phone } });
          
          if (!user) {
              console.warn(`[Auth-Phone] Rejected: User not found for phone ${phone}`);
              return null; 
          }

          if (!user.password) {
               console.warn(`[Auth-Phone] Rejected: User ${phone} has no password`);
               return null;
          }

          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
              console.warn(`[Auth-Phone] Rejected: Password mismatch for ${phone}`);
              return null;
          }

          console.log(`[Auth-Phone] Accepted: Successful login for ${phone}`);
          return { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            image: user.image,
            isVerifiedSeller: user.isVerifiedSeller,
            reputationScore: user.reputationScore,
            isPhoneVerified: user.isPhoneVerified,
            emailVerified: user.emailVerified,
            userLevel: user.userLevel,
            winningStreak: user.winningStreak
          };
        } catch (error) {
          console.error('[Auth-Phone-FATAL] Login failed:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // 1. First login: populate token from the freshly-authenticated user object
      if (user) {
        token.id = user.id;
        // Seed initial values so we avoid an immediate DB hit
        token.isPhoneVerified   = (user as Record<string, unknown>).isPhoneVerified ?? false;
        token.emailVerified     = (user as Record<string, unknown>).emailVerified ?? null;
        token.phone             = (user as Record<string, unknown>).phone ?? null;
        token.reputationScore   = (user as Record<string, unknown>).reputationScore ?? 0;
        token.isVerifiedSeller  = (user as Record<string, unknown>).isVerifiedSeller ?? false;
        token.userLevel         = (user as Record<string, unknown>).userLevel ?? 1;
        token.winningStreak     = (user as Record<string, unknown>).winningStreak ?? 0;
        token.lastDbRefresh     = Date.now();
      }

      // 2. Decide whether to refresh from DB:
      //    - on explicit `update()` call (e.g., after phone verification)
      //    - once per TOKEN_REFRESH_INTERVAL_MS (avoid per-request DB queries)
      const needsRefresh =
        trigger === 'update' ||
        !token.lastDbRefresh ||
        Date.now() - (token.lastDbRefresh as number) > TOKEN_REFRESH_INTERVAL_MS;

      if (token.id && needsRefresh) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              isPhoneVerified: true,
              emailVerified:   true,
              phone:           true,
              reputationScore: true,
              isVerifiedSeller: true,
              userLevel:       true,
              winningStreak:   true,
            },
          });

          if (dbUser) {
            token.isPhoneVerified  = dbUser.isPhoneVerified;
            token.emailVerified    = dbUser.emailVerified;
            token.phone            = dbUser.phone;
            token.reputationScore  = dbUser.reputationScore;
            token.isVerifiedSeller = dbUser.isVerifiedSeller;
            token.userLevel        = dbUser.userLevel;
            token.winningStreak    = dbUser.winningStreak;
            token.lastDbRefresh    = Date.now();
          }
        } catch (error) {
          // Non-fatal: keep serving stale token data rather than breaking the session
          console.error('[Auth] JWT DB refresh failed:', error);
        }
      }

      // 3. Admin check (based on cached token.email — no extra DB query)
      const adminEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);
      token.isAdmin = Boolean(token.email && adminEmails.includes(token.email as string));

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = session.user as any; 
        u.isPhoneVerified = token.isPhoneVerified;
        u.emailVerified = token.emailVerified;
        u.phone = token.phone;
        u.reputationScore = token.reputationScore;
        u.isVerifiedSeller = token.isVerifiedSeller;
        u.userLevel = token.userLevel;
        u.winningStreak = token.winningStreak;
        u.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
});
