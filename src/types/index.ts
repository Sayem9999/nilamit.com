import type { Auction, Bid, User, AuctionStatus, OrderStatus } from '@prisma/client';
export type { AuctionStatus, OrderStatus };

export type AuctionWithSeller = Auction & {
  seller: Pick<User, 'id' | 'name' | 'email' | 'image' | 'isVerifiedSeller' | 'reputationScore' | 'isPhoneVerified'>;
  _count?: { bids: number };
  location?: string | null;
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
