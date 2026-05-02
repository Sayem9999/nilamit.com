import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isPhoneVerified: boolean;
      isVerifiedSeller: boolean;
      reputationScore: number;
      isAdmin: boolean;
      isBanned: boolean;
      userLevel: number;
      xp: number;
      winningStreak: number;
      phone: string | null;
      emailVerified: Date | null;
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    isPhoneVerified: boolean;
    isVerifiedSeller: boolean;
    reputationScore: number;
    isAdmin: boolean;
    isBanned: boolean;
    userLevel: number;
    xp: number;
    winningStreak: number;
    phone: string | null;
    emailVerified: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    isPhoneVerified: boolean;
    isVerifiedSeller: boolean;
    reputationScore: number;
    isAdmin: boolean;
    isBanned: boolean;
    userLevel: number;
    xp: number;
    winningStreak: number;
    phone: string | null;
    emailVerified: Date | null;
    lastDbRefresh?: number;
  }
}
