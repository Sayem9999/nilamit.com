import { AlertType } from './enums';

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

export interface SystemConfig {
  id: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImage: string | null;
  announcement: string | null;
  showAnnouncement: boolean;
  treasuryBkash?: string | null;
  treasuryNagad?: string | null;
  mfsLinkageRequired?: boolean;
  escrowRequired?: boolean;
  commissionPercentageEnabled?: boolean;
  commissionPercentage?: number | null;
  postingRequirementsEnabled?: boolean;
  biddingRequirementsEnabled?: boolean;
  hybridEscrowEnabled?: boolean;
  hybridCommitmentPercentage?: number | null;
  // ─── Marketplace feature kill-switches ───────────────────────────────
  // Operational flags that enable/disable whole features platform-wide.
  // Enforced server-side in the relevant Server Action (never UI-only).
  /** Featured-listing self-serve purchase. Default OFF — flow is incomplete. */
  featuredListingsEnabled?: boolean;
  /** Buy It Now instant purchase. */
  buyItNowEnabled?: boolean;
  /** New auction creation (and relisting). Off = "listings paused". */
  newListingsEnabled?: boolean;
  /** New user self-registration. Off = signups paused. */
  registrationsEnabled?: boolean;
  updatedAt: Date;
}

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
  { id: 'chattogram',   label: 'Chattogram' },
  { id: 'sylhet',       label: 'Sylhet' },
  { id: 'khulna',       label: 'Khulna' },
  { id: 'rajshahi',     label: 'Rajshahi' },
  { id: 'barishal',     label: 'Barishal' },
  { id: 'rangpur',      label: 'Rangpur' },
  { id: 'mymensingh',   label: 'Mymensingh' },
  { id: 'cumilla',      label: 'Cumilla' },
  { id: 'coxsbazar',    label: "Cox's Bazar" },
  { id: 'gazipur',      label: 'Gazipur' },
  { id: 'narayanganj',  label: 'Narayanganj' },
] as const;

export const CATEGORIES = [
  { slug: 'mobile-phones',      label: 'Mobile Phones',      icon: '📱' },
  { slug: 'computers-laptops',  label: 'Computers & Laptops', icon: '💻' },
  { slug: 'electronics',        label: 'Electronics',        icon: '🔌' },
  { slug: 'cameras-optics',     label: 'Cameras & Optics',   icon: '📷' },
  { slug: 'watches-jewelry',    label: 'Watches & Jewelry',  icon: '⌚' },
  { slug: 'vehicles',           label: 'Vehicles',           icon: '🚗' },
  { slug: 'fashion',            label: 'Fashion',            icon: '👗' },
  { slug: 'home-garden',        label: 'Home & Garden',      icon: '🏡' },
  { slug: 'home-appliances',    label: 'Home Appliances',    icon: '📺' },
  { slug: 'sports',             label: 'Sports',             icon: '⚽' },
  { slug: 'hobbies-music',      label: 'Hobbies & Music',    icon: '🎸' },
  { slug: 'books',              label: 'Books',              icon: '📚' },
  { slug: 'collectibles',       label: 'Collectibles',       icon: '🎨' },
  { slug: 'other',              label: 'Other',              icon: '📦' },
] as const;

export type CategorySlug = typeof CATEGORIES[number]['slug'];

