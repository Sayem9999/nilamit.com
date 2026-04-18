import { DefaultSession } from "next-auth";
import type { NIDStatus } from "./index";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      emailVerified?: Date | null;
      isPhoneVerified?: boolean;
      isVerifiedSeller?: boolean;
      isNIDVerified?: boolean;
      nidStatus?: NIDStatus | string;
      reputationScore?: number;
      userLevel?: number;
      winningStreak?: number;
      phone?: string | null;
      isAdmin?: boolean;
    } & DefaultSession["user"]
  }

  interface User {
    emailVerified?: Date | null;
    isPhoneVerified?: boolean;
    isVerifiedSeller?: boolean;
    isNIDVerified?: boolean;
    nidStatus?: NIDStatus | string;
    reputationScore?: number;
    userLevel?: number;
    winningStreak?: number;
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isPhoneVerified?: boolean;
    emailVerified?: Date | string | null;
    isVerifiedSeller?: boolean;
    isNIDVerified?: boolean;
    nidStatus?: NIDStatus | string;
    reputationScore?: number;
    userLevel?: number;
    winningStreak?: number;
    phone?: string | null;
    isAdmin?: boolean;
    lastDbRefresh?: number;
  }
}
