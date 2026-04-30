// ─── Domain Enums (previously from @prisma/client) ────────────────────────────
export const AuctionStatus = {
  DRAFT:             'DRAFT',
  ACTIVE:            'ACTIVE',
  SOLD:              'SOLD',
  EXPIRED:           'EXPIRED',
  CANCELLED:         'CANCELLED',
  AWAITING_PAYMENT:  'AWAITING_PAYMENT',
} as const;
export type AuctionStatus = typeof AuctionStatus[keyof typeof AuctionStatus];

export const OrderStatus = {
  PENDING:   'PENDING',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
  RECEIVED:  'RECEIVED',
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const EscrowStatus = {
  PENDING:      'PENDING',
  HELD:         'HELD',
  RELEASED:     'RELEASED',
  REFUNDED:     'REFUNDED',
  DISPUTED:     'DISPUTED',
  FEE_REFUNDED: 'FEE_REFUNDED',
} as const;
export type EscrowStatus = typeof EscrowStatus[keyof typeof EscrowStatus];

export const DisputeStatus = {
  OPEN:             'OPEN',
  RESOLVED_SELLER:  'RESOLVED_SELLER',
  RESOLVED_BUYER:   'RESOLVED_BUYER',
} as const;
export type DisputeStatus = typeof DisputeStatus[keyof typeof DisputeStatus];

export const ReportStatus = {
  PENDING:   'PENDING',
  REVIEWED:  'REVIEWED',
  RESOLVED:  'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;
export type ReportStatus = typeof ReportStatus[keyof typeof ReportStatus];

export const AlertType = {
  PRICE_DROP:               'PRICE_DROP',
  ENDING_SOON:              'ENDING_SOON',
  OUTBID:                   'OUTBID',
  NEW_AUCTION_IN_CATEGORY:  'NEW_AUCTION_IN_CATEGORY',
  TARGET_REACHED:           'TARGET_REACHED',
} as const;
export type AlertType = typeof AlertType[keyof typeof AlertType];

// ─── Domain Model Interfaces ───────────────────────────────────────────────────
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
  reputationScore: number;
  isBanned: boolean;
  isMinor: boolean;
  isAdmin: boolean;
  googleId?: string | null;
  bkashNumber?: string | null;
  nagadNumber?: string | null;
  winningStreak: number;
  userLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Auction {
  id: string;
  title: string;
  description: string;
  images: string[];
  category: string;
  location?: string | null;
  startingPrice: number;
  currentPrice: number;
  /** Top bidder, denormalised so the bid transaction can read the previous winner via tx.get(). */
  currentBidderId?: string | null;
  reservePrice?: number | null;
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
  winnerId?: string | null;
  bidCount?: number;
  piiDetected?: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    bids: number;
  };
}

export interface SellerPublic {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  reputationScore: number;
  isPhoneVerified: boolean;
  emailVerified: Date | null;
  isVerifiedSeller: boolean;
  winningStreak: number;
  userLevel: number;
  isBanned: boolean;
}

export interface Bid {
  id: string;
  amount: number;
  auctionId: string;
  bidderId: string;
  createdAt: Date;
}

export interface EscrowTransaction {
  id: string;
  auctionId: string;
  buyerId: string;
  amount: number;
  status: EscrowStatus;
  paymentMethod?: string | null;
  providerRef?: string | null;
  automationToken?: string | null;
  verificationType?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dispute {
  id: string;
  transactionId: string;
  openerId: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  auctionId: string;
  reporterId: string;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  isSystemMessage: boolean;
  isRead: boolean;
  createdAt: Date;
}

export interface Alert {
  id: string;
  userId: string;
  auctionId: string | null;
  category: string | null;
  type: AlertType;
  thresholdPrice: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: string;
  auctionId: string;
  fromId: string;
  toId: string;
  rating: number;
  comment?: string | null;
  createdAt: Date;
}

export interface SellerPerformance {
  totalRevenue: number;
  totalAuctions: number;
  activeAuctions: number;
  soldCount: number;
  sellThroughRate: number;
  liquidityRate: number;
  avgBidsPerAuction: number;
  avgSalePrice: number;
  bidVelocity: number;
  reputationGrowth: string;
  revenueByDay: { date: string; revenue: number }[];
  categoryPerformance: { category: string; revenue: number; count: number }[];
}

// ─── Standardized Server Action Result ────────────────────────────────────────
export type ActionResult<T = void> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
export function actionError(error: string, code?: string): ActionResult<never> {
  return { success: false, error, code };
}

export interface SystemConfig {
  id: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImage: string | null;
  announcement: string | null;
  showAnnouncement: boolean;
  treasuryBkash?: string | null;
  treasuryNagad?: string | null;
  updatedAt: Date;
}


export type AuctionWithSeller = Auction & {
  seller: SellerPublic;
  watchlist?: { userId: string }[];
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

// ─── Static Data ────────────────────────────────────────────────────────────────
export const LOCATIONS = [
  { id: 'mirpur',       label: 'Mirpur' },
  { id: 'banani',       label: 'Banani' },
  { id: 'dhanmondi',    label: 'Dhanmondi' },
  { id: 'gulshan',      label: 'Gulshan' },
  { id: 'uttara',       label: 'Uttara' },
  { id: 'motijheel',    label: 'Motijheel' },
  { id: 'mohammadpur',  label: 'Mohammadpur' },
  { id: 'badda',        label: 'Badda' },
  { id: 'khilgaon',     label: 'Khilgaon' },
  { id: 'farmgate',     label: 'Farmgate' },
] as const;

export const CATEGORIES = [
  { slug: 'mobile-phones',  label: 'Mobile Phones',  icon: '📱' },
  { slug: 'electronics',    label: 'Electronics',    icon: '💻' },
  { slug: 'vehicles',       label: 'Vehicles',       icon: '🚗' },
  { slug: 'fashion',        label: 'Fashion',        icon: '👗' },
  { slug: 'home-garden',    label: 'Home & Garden',  icon: '🏡' },
  { slug: 'sports',         label: 'Sports',         icon: '⚽' },
  { slug: 'books',          label: 'Books',          icon: '📚' },
  { slug: 'collectibles',   label: 'Collectibles',   icon: '🎨' },
  { slug: 'other',          label: 'Other',          icon: '📦' },
] as const;

export type CategorySlug = typeof CATEGORIES[number]['slug'];

export interface ChatData extends Conversation {
  messages: Message[];
  auction: {
    id: string;
    title: string;
    seller: { name: string | null; image: string | null };
    winner: { name: string | null; image: string | null } | null;
  };
}

export interface ReviewWithDetails extends Review {
  from: { name: string | null; image: string | null };
  auction: { title: string };
}

export interface PublicProfile extends SellerPublic {
  _count: {
    auctionsAsSeller: number;
    bids: number;
  };
}

export interface AuctionListResponse {
  auctions: AuctionWithSeller[];
  total: number;
  pages: number;
  currentPage: number;
}

export interface LatestActivity {
  id: string;
  amount: number;
  createdAt: Date;
  bidder: { name: string | null };
  auction: { id: string; title: string };
}
