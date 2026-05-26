import { AuctionStatus, OrderStatus } from './enums';
import { SellerPublic, User } from './user';
import { EscrowTransaction, Dispute } from './finance';

export interface Auction {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  location?: string | null;
  startingPrice: number;
  currentPrice: number;
  currentBidderId?: string | null;
  proxyMaxBid?: number | null;
  proxyBidderId?: string | null;
  reservePrice?: number | null;
  isReserveMet?: boolean;
  buyItNowPrice?: number | null;
  minBidIncrement: number;
  startTime: Date;
  endTime: Date;
  status: AuctionStatus;
  isFeatured?: boolean;
  wasExtended?: boolean;
  commissionRate?: number;
  commissionEarned?: number | null;
  deliveryCharge?: number;
  deliveryStatus?: OrderStatus;
  trackingNumber?: string | null;
  sellerId: string;
  condition?: 'NEW' | 'USED' | 'REFURBISHED' | null;
  logistics?: Logistics;
  winnerId?: string | null;
  originalWinnerId?: string | null;
  bidCount?: number;
  piiDetected?: boolean;
  secondHighestBidderId?: string | null;
  secondHighestBidAmount?: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    bids: number;
  };
}

export interface Bid {
  id: string;
  amount: number;
  publicAmount?: number;
  auctionId: string;
  bidderId: string;
  status?: 'ACTIVE' | 'CANCELLED';
  createdAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface RealTimeBid {
  id:         string;
  amount:     number;
  endTime:    Date | string;
  bidderName: string;
  bidderId:   string;
  createdAt:  string;
}

export interface Logistics {
  status: string;
  trackingId: string;
  history: {
    status: string;
    timestamp: Date;
    location?: string;
    description?: string;
  }[];
}

export type AuctionWithSeller = Auction & {
  seller: SellerPublic;
  winner?: { id: string; name: string | null; image: string | null } | null;
  watchlist?: { userId: string }[];
  isWatchlisted?: boolean;
};

export type BidWithBidder = Bid & { 
  bidder: Pick<User, 'id' | 'name' | 'image'> 
};

export type AuctionWithBids = AuctionWithSeller & {
  bids: BidWithBidder[];
  winner?: Pick<User, 'id' | 'name' | 'image'> | null;
  escrowTransaction?: (EscrowTransaction & { dispute?: Dispute | null }) | null;
};

export type BidWithAuction = Bid & {
  auction: Pick<Auction, 'id' | 'title' | 'images' | 'currentPrice' | 'endTime' | 'status'>;
};

export interface PlaceBidResult {
  bid: Bid;
  newEndTime: Date;
  antiSnipeTriggered: boolean;
  newCurrentPrice: number;
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
  condition?: 'NEW' | 'USED' | 'REFURBISHED';
  search?: string;
  sortBy?: 'endTime' | 'currentPrice' | 'createdAt' | 'bids';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  lastId?: string;
  isFeatured?: boolean;
  viewerId?: string | null;
}

export interface AuctionListResponse {
  auctions: AuctionWithSeller[];
  total: number;
  lastId: string | null;
}

export interface LatestActivity {
  id: string;
  amount: number;
  createdAt: Date;
  bidder: { name: string | null };
  auction: { id: string; title: string };
}
