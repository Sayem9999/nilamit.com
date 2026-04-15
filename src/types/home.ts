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
