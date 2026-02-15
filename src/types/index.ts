import type { Auction, Bid, User } from '@prisma/client';

export type AuctionStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type AuctionWithSeller = Auction & {
  seller: Pick<User, 'id' | 'name' | 'image' | 'reputationScore' | 'isPhoneVerified'>;
  _count?: { bids: number };
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
}

export interface AuctionFilters {
  status?: AuctionStatus;
  category?: string;
  search?: string;
  sortBy?: 'endTime' | 'currentPrice' | 'createdAt' | 'bids';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

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
