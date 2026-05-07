import NextAuth from 'next-auth';
import type { Adapter, AdapterUser, AdapterAccount, VerificationToken, AdapterSession } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';
import { isAdminEmail } from '@/lib/admin-guard';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';

// ─── Inline Firestore Adapter (JWT-strategy, minimal surface) ──
function FirestoreAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const ref = db.collection('users').doc();
      const now = new Date();
      const doc = { ...user, id: ref.id, createdAt: now, updatedAt: now,
        isPhoneVerified: false, isVerifiedSeller: false,
        reputationScore: 0, winningStreak: 0, xp: 0, userLevel: 1 };
      await ref.set(doc);
      return { ...doc } as AdapterUser;
    },
    async getUser(id: string) {
      const snap = await db.collection('users').doc(id).get();
      if (!snap.exists) return null;
      return { ...snap.data(), id: snap.id } as AdapterUser;
    },
    async getUserByEmail(email: string) {
      const snap = await db.collection('users').where('email', '==', email).limit(1).get();
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { ...d.data(), id: d.id } as AdapterUser;
    },
    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const snap = await db.collection('accounts')
        .where('provider', '==', provider)
        .where('providerAccountId', '==', providerAccountId)
        .limit(1).get();
      if (snap.empty) return null;
      const { userId } = snap.docs[0].data() as { userId: string };
      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) return null;
      return { ...userSnap.data(), id: userSnap.id } as AdapterUser;
    },
    async updateUser(user: Partial<AdapterUser> & { id: string }) {
      const { id, ...rest } = user;
      await db.collection('users').doc(id).update({ ...rest, updatedAt: new Date() });
      const snap = await db.collection('users').doc(id).get();
      return { ...snap.data(), id: snap.id } as AdapterUser;
    },
    async linkAccount(account: AdapterAccount) {
      const ref = db.collection('accounts').doc();
      await ref.set({ ...account, id: ref.id });
      return account;
    },
    async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
      const snap = await db.collection('accounts')
        .where('provider', '==', provider)
        .where('providerAccountId', '==', providerAccountId)
        .limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
    },
    // JWT strategy — sessions not stored in DB
    async createSession(session) { return session as unknown as AdapterSession; },
    async getSessionAndUser() { return null; },
    async updateSession(session) { return session as unknown as AdapterSession; },
    async deleteSession() {},
    async createVerificationToken(token: VerificationToken) {
      const id = crypto.createHash('sha256').update(`${token.identifier}:${token.token}`).digest('hex');
      await db.collection('verificationTokens').doc(id).set(token);
      return token;
    },
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const id = crypto.createHash('sha256').update(`${identifier}:${token}`).digest('hex');
      const snap = await db.collection('verificationTokens').doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() as VerificationToken;
      await snap.ref.delete();
      return { ...data, expires: data.expires instanceof Date ? data.expires : new Date(data.expires) };
    },
  };
}

/** Internal helper for reusable auth lookup logic */
async function verifyUser(field: 'email' | 'phone', value: string, passwordRaw: string) {
  try {
    const snap = await db.collection('users').where(field, '==', value).limit(1).get();
    if (snap.empty) return null;
    
    const user = { ...snap.docs[0].data(), id: snap.docs[0].id } as Record<string, unknown>;
    if (!user.password) return null;
    
    const valid = await bcrypt.compare(passwordRaw, user.password as string);
    if (!valid) return null;

    return { 
      id: user.id as string, 
      email: user.email as string | null, 
      name: user.name as string,
      image: user.image as string | null,
      isVerifiedSeller: Boolean(user.isVerifiedSeller), 
      reputationScore: Number(user.reputationScore || 0),
      rating: Number(user.rating || user.reputationScore || 0),
      ratingCount: Number(user.ratingCount || 0),
      isPhoneVerified: Boolean(user.isPhoneVerified), 
      emailVerified: user.emailVerified as Date | null,
      userLevel: Number(user.userLevel || 1), 
      xp: Number(user.xp || 0), 
      winningStreak: Number(user.winningStreak || 0),
      isBanned: Boolean(user.isBanned),
      bkashNumber: user.bkashNumber as string | null | undefined,
      nagadNumber: user.nagadNumber as string | null | undefined
    };
  } catch (e) {
    log.error(`[Auth] verifyUser failed for ${field}`, e);
    return null;
  }
}

// ─── Provider feature flags ─────────────────────────────────────
const googleClientId     = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;
const googleEnabled      = Boolean(googleClientId && googleClientSecret);

if (!googleEnabled && process.env.NODE_ENV === 'production') {
  log.error('[Auth-WARN] Google OAuth disabled — missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
}

// 5 minutes: short enough that ban/verification changes propagate quickly,
// long enough to avoid hammering Firestore on every request.
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: FirestoreAdapter(),
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return verifyUser('email', (credentials.email as string).trim().toLowerCase(), credentials.password as string);
      },
    }),
    Credentials({
      id: 'phone',
      name: 'Phone',
      credentials: {
        phone:    { label: 'Phone',    type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;
        return verifyUser('phone', credentials.phone as string, credentials.password as string);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // First login — seed from freshly-authenticated user
      if (user) {
        token.id               = user.id!;
        token.isPhoneVerified  = user.isPhoneVerified ?? false;
        token.isVerifiedSeller = user.isVerifiedSeller ?? false;
        token.reputationScore  = user.reputationScore ?? 0;
        token.rating           = user.rating ?? user.reputationScore ?? 0;
        token.ratingCount      = user.ratingCount ?? 0;
        token.isAdmin          = user.isAdmin ?? false;
        token.isBanned         = user.isBanned ?? false;
        token.userLevel        = user.userLevel ?? 1;
        token.xp               = user.xp ?? 0;
        token.winningStreak    = user.winningStreak ?? 0;
        token.isRetailer       = user.isRetailer ?? false;
        token.isTopRated       = user.isTopRated ?? false;
        token.salesCount       = user.salesCount ?? 0;
        token.defectCount      = user.defectCount ?? 0;
        token.phone            = user.phone ?? null;
        token.emailVerified    = user.emailVerified ?? null;
        token.bkashNumber      = user.bkashNumber ?? null;
        token.nagadNumber      = user.nagadNumber ?? null;
        token.lastDbRefresh    = Date.now();
      }

      // Refresh from Firestore only on explicit update triggers
      const needsRefresh = trigger === 'update';

      if (token.id && needsRefresh) {
        try {
          const snap = await db.collection('users').doc(token.id as string).get();
          if (snap.exists) {
            const u = snap.data()!;
            token.isPhoneVerified  = u.isPhoneVerified;
            token.isVerifiedSeller = u.isVerifiedSeller;
            token.reputationScore  = u.reputationScore;
            token.rating           = u.rating ?? u.reputationScore;
            token.ratingCount      = u.ratingCount;
            token.userLevel        = u.userLevel;
            token.xp               = u.xp;
            token.winningStreak    = u.winningStreak;
            token.isBanned         = u.isBanned;
            token.isRetailer       = u.isRetailer;
            token.isTopRated       = u.isTopRated;
            token.salesCount       = u.salesCount ?? 0;
            token.defectCount      = u.defectCount ?? 0;
            token.phone            = u.phone ?? null;
            token.emailVerified    = u.emailVerified ?? null;
            token.bkashNumber      = u.bkashNumber ?? null;
            token.nagadNumber      = u.nagadNumber ?? null;
            token.lastDbRefresh    = Date.now();
          }
        } catch (e) {
          log.error('[Auth] JWT Firestore refresh failed', e);
        }
      }

      // Admin check — derived from env var, NOT from user-supplied token data
      token.isAdmin = isAdminEmail(token.email as string);

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        session.user.id              = token.id as any;
        session.user.isPhoneVerified  = token.isPhoneVerified as any;
        session.user.isVerifiedSeller = token.isVerifiedSeller as any;
        session.user.reputationScore  = token.reputationScore as any;
        session.user.rating           = token.rating as any;
        session.user.ratingCount      = token.ratingCount as any;
        session.user.isAdmin          = token.isAdmin as any;
        session.user.isBanned         = token.isBanned as any;
        session.user.userLevel        = token.userLevel as any;
        session.user.xp               = token.xp as any;
        session.user.winningStreak    = token.winningStreak as any;
        session.user.phone            = token.phone as any;
        session.user.emailVerified    = token.emailVerified as any;
        session.user.isRetailer       = token.isRetailer as any;
        session.user.isTopRated       = token.isTopRated as any;
        session.user.salesCount       = token.salesCount as any;
        session.user.defectCount      = token.defectCount as any;
        session.user.bkashNumber     = token.bkashNumber as any;
        session.user.nagadNumber     = token.nagadNumber as any;
        /* eslint-enable @typescript-eslint/no-explicit-any */
      }
      return session;
    },
  },
});
