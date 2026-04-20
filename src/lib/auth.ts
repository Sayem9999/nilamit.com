import NextAuth from 'next-auth';
import type { Adapter, AdapterUser, AdapterAccount, VerificationToken } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { authConfig } from '@/lib/auth.config';

// ─── Inline Firestore Adapter (JWT-strategy, minimal surface) ──
function FirestoreAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const ref = db.collection('users').doc();
      const now = new Date();
      const doc = { ...user, id: ref.id, createdAt: now, updatedAt: now,
        isPhoneVerified: false, isVerifiedSeller: false,
        reputationScore: 0, winningStreak: 0, userLevel: 1 };
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
    async createSession(session) { return session; },
    async getSessionAndUser() { return null; },
    async updateSession(session) { return session; },
    async deleteSession() {},
    async createVerificationToken(token: VerificationToken) {
      const id = `${token.identifier}__${token.token}`;
      await db.collection('verificationTokens').doc(id).set(token);
      return token;
    },
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const id = `${identifier}__${token}`;
      const snap = await db.collection('verificationTokens').doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() as VerificationToken;
      await snap.ref.delete();
      return { ...data, expires: data.expires instanceof Date ? data.expires : new Date(data.expires) };
    },
  };
}

// ─── Provider feature flags ─────────────────────────────────────
const googleClientId     = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleEnabled      = Boolean(googleClientId && googleClientSecret);

if (!googleEnabled && process.env.NODE_ENV === 'production') {
  console.error('[Auth-WARN] Google OAuth disabled — missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
}

const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: FirestoreAdapter(),
  providers: [
    ...(googleEnabled
      ? [Google({ clientId: googleClientId!, clientSecret: googleClientSecret! })]
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
        const email    = credentials.email as string;
        const password = credentials.password as string;
        try {
          const snap = await db.collection('users').where('email', '==', email).limit(1).get();
          if (snap.empty) return null;
          const user = { ...snap.docs[0].data(), id: snap.docs[0].id } as Record<string, unknown>;
          if (!user.password) return null;
          const valid = await bcrypt.compare(password, user.password as string);
          if (!valid) return null;
          return { id: user.id as string, email: user.email as string, name: user.name as string,
            image: user.image as string | null,
            isVerifiedSeller: user.isVerifiedSeller, reputationScore: user.reputationScore,
            isPhoneVerified: user.isPhoneVerified, emailVerified: user.emailVerified,
            userLevel: user.userLevel, winningStreak: user.winningStreak };
        } catch (e) {
          console.error('[Auth] credentials authorize error:', e);
          return null;
        }
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
        const phone    = credentials.phone as string;
        const password = credentials.password as string;
        try {
          const snap = await db.collection('users').where('phone', '==', phone).limit(1).get();
          if (snap.empty) return null;
          const user = { ...snap.docs[0].data(), id: snap.docs[0].id } as Record<string, unknown>;
          if (!user.password) return null;
          const valid = await bcrypt.compare(password, user.password as string);
          if (!valid) return null;
          return { id: user.id as string, email: user.email as string | null,
            name: user.name as string, image: user.image as string | null,
            isVerifiedSeller: user.isVerifiedSeller, reputationScore: user.reputationScore,
            isPhoneVerified: user.isPhoneVerified, emailVerified: user.emailVerified,
            userLevel: user.userLevel, winningStreak: user.winningStreak };
        } catch (e) {
          console.error('[Auth-Phone] authorize error:', e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // First login — seed from freshly-authenticated user
      if (user) {
        token.id               = user.id;
        token.isPhoneVerified  = (user as unknown as Record<string, unknown>).isPhoneVerified  ?? false;
        token.emailVerified    = (user as unknown as Record<string, unknown>).emailVerified    ?? null;
        token.phone            = (user as unknown as Record<string, unknown>).phone            ?? null;
        token.reputationScore  = (user as unknown as Record<string, unknown>).reputationScore  ?? 0;
        token.isVerifiedSeller = (user as unknown as Record<string, unknown>).isVerifiedSeller ?? false;
        token.userLevel        = (user as unknown as Record<string, unknown>).userLevel        ?? 1;
        token.winningStreak    = (user as unknown as Record<string, unknown>).winningStreak    ?? 0;
        token.lastDbRefresh    = Date.now();
      }

      // Refresh from Firestore on update trigger or after interval
      const needsRefresh =
        trigger === 'update' ||
        !token.lastDbRefresh ||
        Date.now() - (token.lastDbRefresh as number) > TOKEN_REFRESH_INTERVAL_MS;

      if (token.id && needsRefresh) {
        try {
          const snap = await db.collection('users').doc(token.id as string).get();
          if (snap.exists) {
            const u = snap.data()!;
            token.isPhoneVerified  = u.isPhoneVerified;
            token.emailVerified    = u.emailVerified   ?? null;
            token.phone            = u.phone           ?? null;
            token.reputationScore  = u.reputationScore ?? 0;
            token.isVerifiedSeller = u.isVerifiedSeller ?? false;
            token.userLevel        = u.userLevel        ?? 1;
            token.winningStreak    = u.winningStreak    ?? 0;
            token.lastDbRefresh    = Date.now();
          }
        } catch (e) {
          console.error('[Auth] JWT Firestore refresh failed:', e);
        }
      }

      // Admin check — derived from env var, NOT from user-supplied token data
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
      token.isAdmin = Boolean(token.email && adminEmails.includes(token.email as string));

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id              = token.id;
        u.isPhoneVerified  = token.isPhoneVerified;
        u.emailVerified    = token.emailVerified;
        u.phone            = token.phone;
        u.reputationScore  = token.reputationScore;
        u.isVerifiedSeller = token.isVerifiedSeller;
        u.userLevel        = token.userLevel;
        u.winningStreak    = token.winningStreak;
        u.isAdmin          = token.isAdmin;
      }
      return session;
    },
  },
});
