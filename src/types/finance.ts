import { EscrowStatus, DisputeStatus } from './enums';

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
