import { DefaultSession } from "next-auth";
import { AdapterUser as BaseAdapterUser } from "@auth/core/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isVerifiedSeller: boolean;
      isAdmin?: boolean;
      isPhoneVerified?: boolean;
      phone?: string | null;
      reputationScore?: number;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    isVerifiedSeller: boolean;
    isAdmin?: boolean;
    isPhoneVerified?: boolean;
    phone?: string | null;
    reputationScore?: number;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser extends BaseAdapterUser {
    id: string;
    isVerifiedSeller: boolean;
    isAdmin?: boolean;
    isPhoneVerified?: boolean;
    phone?: string | null;
    reputationScore?: number;
  }
}