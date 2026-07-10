/**
 * Seller KYC pipeline state.
 *   NONE     → never submitted
 *   PENDING  → docs uploaded, awaiting moderator
 *   APPROVED → moderator confirmed; user may show verified-business badge
 *   REJECTED → moderator rejected; reason in users/{uid}.kycRejectReason
 */
export type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Per-channel notification opt-in. Defaults to RTDB + FCM enabled, others off.
 * Stored on users/{uid}.notificationChannels.
 */
export interface NotificationChannelPrefs {
  inApp: boolean; // RTDB dashboard inbox — always on for active users
  fcm: boolean;   // Browser push
  email: boolean; // Resend
  sms: boolean;   // SMS gateway (requires phone verified)
  whatsapp: boolean; // WhatsApp Business API (requires user opt-in)
}

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  password?: string | null;
  isVerifiedSeller: boolean;
  rating: number;
  ratingCount: number;
  reputationScore: number;
  isBanned: boolean;
  isMinor: boolean;
  isAdmin: boolean;
  googleId?: string | null;
  bkashNumber?: string | null;
  nagadNumber?: string | null;
  /** Verified mobile number for SMS/WhatsApp notifications. */
  phoneNumber?: string | null;
  phoneVerified?: Date | null;
  winningStreak: number;
  xp: number;
  userLevel: number;
  isTopRated: boolean;
  isRetailer: boolean;
  /** First-party listings sold by the platform itself — renders the "Official Store" badge and appears on /store. Admin-granted. */
  isOfficialStore?: boolean;
  salesCount: number;
  defectCount: number;
  bio?: string | null;
  banner?: string | null;
  lastActiveIp?: string | null;
  lastActiveUserAgent?: string | null;
  /** FCM browser-push tokens — array because a user may have multiple devices. */
  fcmTokens?: string[];
  fcmTokensUpdatedAt?: Date | null;
  /** Channel-preference matrix. Falls back to defaults if missing. */
  notificationChannels?: NotificationChannelPrefs;
  /** KYC pipeline state. Public-facing "verified business" badge only shows when APPROVED. */
  kycStatus?: KycStatus;
  kycSubmittedAt?: Date | null;
  kycDocsRef?: {
    nidFrontUrl?: string;
    nidBackUrl?: string;
    tradeLicenseUrl?: string;
    selfieUrl?: string;
  } | null;
  kycRejectReason?: string | null;
  kycReviewedAt?: Date | null;
  kycReviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerPublic {
  id: string;
  name: string | null;
  image: string | null;
  rating: number;
  ratingCount: number;
  reputationScore: number;
  emailVerified: Date | null;
  isVerifiedSeller: boolean;
  isRetailer: boolean;
  /** Platform's own storefront — "Official Store" badge. */
  isOfficialStore?: boolean;
  winningStreak: number;
  userLevel: number;
  isTopRated: boolean;
  salesCount: number;
  defectCount: number;
  isBanned: boolean;
  bio?: string | null;
  banner?: string | null;
  lastActiveIp?: string | null;
  lastActiveUserAgent?: string | null;
}

export interface PublicProfile extends SellerPublic {
  _count: {
    auctionsAsSeller: number;
    bids: number;
  };
}
