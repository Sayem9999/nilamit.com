import type { Auction, Bid, User, AuctionStatus, OrderStatus } from '@prisma/client';
export type { AuctionStatus, OrderStatus };

// ─── Standardized Server Action Result ────────────────────────
/**
 * All server actions MUST return ActionResult<T>.
 * This creates a predictable contract for UI error handling.
 *
 * Usage:
 *   export async function myAction(): Promise<ActionResult<{ id: string }>> {
 *     try {
 *       return { success: true, data: { id: '...' } };
 *     } catch {
 *       return actionError('Something went wrong');
 *     }
 *   }
 *
 * Client-side:
 *   const result = await myAction();
 *   if (!result.success) { showError(result.error); return; }
 *   console.log(result.data.id);
 */
export type ActionResult<T = void> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: string };

/** Helper: create a success result */
export function actionOk<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/** Helper: create a typed error result */
export function actionError(
  error: string,
  code?: string
): ActionResult<never> {
  return { success: false, error, code };
}

// ─── Known error codes ────────────────────────────────────────
export const ERROR = {
  // Auth
  NOT_AUTHENTICATED:          'NOT_AUTHENTICATED',
  PHONE_NOT_VERIFIED:         'PHONE_NOT_VERIFIED',
  FORBIDDEN:                  'FORBIDDEN',
  // Input
  VALIDATION_ERROR:           'VALIDATION_ERROR',
  NOT_FOUND:                  'NOT_FOUND',
  // Auction
  AUCTION_NOT_ACTIVE:         'AUCTION_NOT_ACTIVE',
  BID_TOO_LOW:                'BID_TOO_LOW',
  OWN_AUCTION:                'OWN_AUCTION',
  BID_DEPOSIT_REQUIRED:       'BID_DEPOSIT_REQUIRED',
  // Server
  INTERNAL_ERROR:             'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ERROR[keyof typeof ERROR];

export type AuctionWithSeller = Auction & {
  seller: Pick<User, 'id' | 'name' | 'email' | 'image' | 'isVerifiedSeller' | 'reputationScore' | 'isPhoneVerified' | 'winningStreak' | 'userLevel'>;
  _count?: { bids: number };
  location?: string | null;
  watchlist?: { userId: string }[];
};

export type AuctionWithBids = AuctionWithSeller & {
  bids: (Bid & { bidder: Pick<User, 'id' | 'name' | 'image'> })[];
  winner?: Pick<User, 'id' | 'name' | 'image'> | null;
};

export type BidWithAuction = Bid & {
  auction: Pick<Auction, 'id' | 'title' | 'images' | 'currentPrice' | 'endTime' | 'status'>;
};

export interface PlaceBidResult {
  success: boolean;
  error?: string;
  bid?: Bid;
  newEndTime?: Date;
  antiSnipeTriggered?: boolean;
}

export interface CreateAuctionInput {
  title: string;
  description: string;
  images: string[];
  category: string;
  startingPrice: number;
  minBidIncrement?: number;
  startTime: string;
  endTime: string;
  reservePrice?: number;
  buyItNowPrice?: number;
  location?: string;
}

export interface AuctionFilters {
  status?: AuctionStatus;
  category?: string;
  location?: string;
  search?: string;
  sortBy?: 'endTime' | 'currentPrice' | 'createdAt' | 'bids';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const LOCATIONS = [
  { id: 'mirpur', label: 'Mirpur' },
  { id: 'banani', label: 'Banani' },
  { id: 'dhanmondi', label: 'Dhanmondi' },
  { id: 'gulshan', label: 'Gulshan' },
  { id: 'uttara', label: 'Uttara' },
  { id: 'motijheel', label: 'Motijheel' },
  { id: 'mohammadpur', label: 'Mohammadpur' },
  { id: 'badda', label: 'Badda' },
  { id: 'khilgaon', label: 'Khilgaon' },
  { id: 'farmgate', label: 'Farmgate' },
] as const;

export const CATEGORIES = [
  { slug: 'mobile-phones', label: 'Mobile Phones', icon: '📱' },
  { slug: 'electronics', label: 'Electronics', icon: '💻' },
  { slug: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { slug: 'fashion', label: 'Fashion', icon: '👗' },
  { slug: 'home-garden', label: 'Home & Garden', icon: '🏡' },
  { slug: 'sports', label: 'Sports', icon: '⚽' },
  { slug: 'books', label: 'Books', icon: '📚' },
  { slug: 'collectibles', label: 'Collectibles', icon: '🎨' },
  { slug: 'other', label: 'Other', icon: '📦' },
] as const;

export type CategorySlug = typeof CATEGORIES[number]['slug'];
