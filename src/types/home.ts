export interface SystemConfig {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string | null;
  announcement: string | null;
  showAnnouncement: boolean;
  updatedAt: Date;
}
