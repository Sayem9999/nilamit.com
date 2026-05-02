import { ReportStatus } from './enums';

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

export interface ChatData extends Conversation {
  messages: Message[];
  auction: {
    id: string;
    title: string;
    seller: { name: string | null; image: string | null };
    winner: { name: string | null; image: string | null } | null;
  };
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

export interface Review {
  id: string;
  auctionId: string;
  fromId: string;
  toId: string;
  rating: number;
  comment?: string | null;
  createdAt: Date;
}

export interface ReviewWithDetails extends Review {
  from: { name: string | null; image: string | null };
  auction: { title: string };
}
