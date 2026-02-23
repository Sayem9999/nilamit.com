import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [],
  session: { strategy: 'jwt' },
  callbacks: {},
} satisfies NextAuthConfig;
