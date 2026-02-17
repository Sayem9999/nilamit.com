import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

import { authConfig } from '@/lib/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || 'dummy',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
            console.log('[Auth] Missing credentials');
            return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
            console.log(`[Auth] User not found for email: ${email}`);
            return null; 
        }

        if (!user.password) {
             console.log(`[Auth] User found but HAS NO PASSWORD set: ${email} (Legacy account or Google sign-in)`);
             return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            console.log(`[Auth] Password mismatch for user: ${email}`);
            return null;
        }

        console.log(`[Auth] Login successful for: ${email}`);
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      // Fetch phone verification status
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isPhoneVerified: true, phone: true, reputationScore: true, email: true },
        });
        if (dbUser) {
          token.isPhoneVerified = dbUser.isPhoneVerified;
          token.phone = dbUser.phone;
          token.reputationScore = dbUser.reputationScore;
        }
      }
      
      // Admin Check
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
      if (token.email && adminEmails.includes(token.email)) {
        token.isAdmin = true;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        const u = session.user as any; // Cast to allow custom properties
        u.isPhoneVerified = token.isPhoneVerified;
        u.phone = token.phone;
        u.reputationScore = token.reputationScore;
        u.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
