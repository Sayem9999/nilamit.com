import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      emailVerified?: Date | null;
      isPhoneVerified?: boolean;
    } & DefaultSession["user"]
  }

  interface User {
    emailVerified?: Date | null;
    isPhoneVerified?: boolean;
  }
}
