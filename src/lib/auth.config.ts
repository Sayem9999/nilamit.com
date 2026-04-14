import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { 
    strategy: 'jwt',
  },
  callbacks: {
    authorized() {
      return true; // Let the proxy handle redirection logic
    },
  },
  providers: [], // Add providers in auth.ts
} satisfies NextAuthConfig;
