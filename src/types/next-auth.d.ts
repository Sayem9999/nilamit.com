import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isPhoneVerified: boolean;
      isVerifiedSeller: boolean;
      reputationScore: number;
      rating: number;
      ratingCount: number;
      isAdmin: boolean;
      isBanned: boolean;
      userLevel: number;
      xp: number;
      winningStreak: number;
      phone: string | null;
      emailVerified: Date | null;
      isRetailer: boolean;
      isTopRated: boolean;
      salesCount: number;
      defectCount: number;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    isPhoneVerified?: boolean;
    isVerifiedSeller?: boolean;
    reputationScore?: number;
    rating?: number;
    ratingCount?: number;
    isAdmin?: boolean;
    isBanned?: boolean;
    userLevel?: number;
    xp?: number;
    winningStreak?: number;
    phone?: string | null;
    emailVerified?: Date | null;
    isRetailer?: boolean;
    isTopRated?: boolean;
    salesCount?: number;
    defectCount?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    isPhoneVerified: boolean;
    isVerifiedSeller: boolean;
    reputationScore: number;
    rating: number;
    ratingCount: number;
    isAdmin: boolean;
    isBanned: boolean;
    userLevel: number;
    xp: number;
    winningStreak: number;
    phone: string | null;
    emailVerified: Date | null;
    isRetailer: boolean;
    isTopRated: boolean;
    salesCount: number;
    defectCount: number;
    lastDbRefresh: number;
  }
}
