import { DefaultSession, User as NextAuthUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isVerifiedSeller: boolean;
      isAdmin?: boolean;
      isPhoneVerified?: boolean;
      emailVerified?: Date | null;
      phone?: string | null;
      reputationScore?: number;
      rating?: number;
      ratingCount?: number;
      isBanned?: boolean;
      userLevel?: number;
      xp?: number;
      winningStreak?: number;
    } & DefaultSession["user"];
  }

  interface User extends NextAuthUser {
    isVerifiedSeller: boolean;
    isAdmin?: boolean;
    isPhoneVerified?: boolean;
    emailVerified?: Date | null;
    phone?: string | null;
    reputationScore?: number;
    rating?: number;
    ratingCount?: number;
    isBanned?: boolean;
    userLevel?: number;
    xp?: number;
    winningStreak?: number;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser extends NextAuthUser {
    isVerifiedSeller: boolean;
    isAdmin?: boolean;
    isPhoneVerified?: boolean;
    emailVerified?: Date | null;
    phone?: string | null;
    reputationScore?: number;
    rating?: number;
    ratingCount?: number;
    isBanned?: boolean;
    userLevel?: number;
    xp?: number;
    winningStreak?: number;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isVerifiedSeller: boolean;
    isAdmin?: boolean;
    isPhoneVerified?: boolean;
    emailVerified?: Date | null;
    phone?: string | null;
    reputationScore?: number;
    rating?: number;
    ratingCount?: number;
    isBanned?: boolean;
    userLevel?: number;
    xp?: number;
    winningStreak?: number;
    lastDbRefresh?: number;
  }
}
