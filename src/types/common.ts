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
