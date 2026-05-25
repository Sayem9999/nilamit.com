import { EscrowStatus, DisputeStatus } from './enums';

export interface EscrowTransaction {
  id: string;
  auctionId: string;
  buyerId: string;
  sellerId: string; // Ensure this is present
  amount: number;
  totalAmount?: number;
  codAmount?: number;
  deliveryDeposit: number;
  status: EscrowStatus;
  paymentMethod?: string | null;
  providerRef?: string | null;
  automationToken?: string | null;
  verificationType?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HydratedEscrowTransaction extends EscrowTransaction {
  auction: {
    title: string;
    seller: { name: string | null; image: string | null };
    endTime: Date | string;
  };
  dispute: Dispute | null;
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
