export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  password?: string | null;
  phone?: string | null;
  isPhoneVerified: boolean;
  isVerifiedSeller: boolean;
  rating: number;
  ratingCount: number;
  isBanned: boolean;
  isMinor: boolean;
  isAdmin: boolean;
  googleId?: string | null;
  bkashNumber?: string | null;
  nagadNumber?: string | null;
  winningStreak: number;
  xp: number;
  userLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerPublic {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  rating: number;
  ratingCount: number;
  isPhoneVerified: boolean;
  emailVerified: Date | null;
  isVerifiedSeller: boolean;
  winningStreak: number;
  userLevel: number;
  isBanned: boolean;
}

export interface PublicProfile extends SellerPublic {
  _count: {
    auctionsAsSeller: number;
    bids: number;
  };
}
