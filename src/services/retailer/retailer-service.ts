import { db, toDate } from '@/lib/db';
import { ServiceResponse, successResponse, errorResponse, ErrorType } from '@/lib/errors';
import { Auction, EscrowTransaction } from '@/types';

export interface RetailerStats {
  totalSales: number;
  grossVolume: number;
  netRevenue: number;
  avgSalePrice: number;
  sellThroughRate: number;
  activeListings: number;
  pendingDeliveries: number;
  disputeRate: number;
  shillReports: number;
  dailyRevenue: { date: string; amount: number }[];
}

export class RetailerService {
  static async getDashboardStats(sellerId: string): Promise<ServiceResponse<RetailerStats>> {
    try {
      const [auctionsSnap, escrowSnap, shillSnap] = await Promise.all([
        db.collection('auctions').where('sellerId', '==', sellerId).get(),
        db.collection('escrowTransactions').where('sellerId', '==', sellerId).get(),
        db.collection('reports').where('targetId', '==', sellerId).where('reason', '==', 'SHILL_BIDDING').get(),
      ]);

      const auctions = auctionsSnap.docs.map(d => d.data() as Auction);
      const escrows = escrowSnap.docs.map(d => d.data() as EscrowTransaction);

      const soldAuctions = auctions.filter(a => a.status === 'SOLD');
      const activeAuctions = auctions.filter(a => a.status === 'ACTIVE');
      
      const grossVolume = soldAuctions.reduce((acc, a) => acc + (a.currentPrice || 0), 0);
      const commission = soldAuctions.reduce((acc, a) => acc + (a.commissionEarned || 0), 0);
      const netRevenue = grossVolume - commission;

      const pendingDeliveries = escrows.filter(e => e.status === 'HELD').length;
      const disputes = escrows.filter(e => e.status === 'DISPUTED').length;

      // Sell-through rate: Sold / (Sold + Expired)
      const expiredCount = auctions.filter(a => a.status === 'EXPIRED').length;
      const totalEnded = soldAuctions.length + expiredCount;
      const sellThroughRate = totalEnded > 0 ? (soldAuctions.length / totalEnded) * 100 : 0;

      // Generate daily revenue for the last 7 days
      const dailyRevenue: { date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayRevenue = soldAuctions
          .filter(a => {
            const updatedAt = toDate(a.updatedAt as unknown as Parameters<typeof toDate>[0]);
            return updatedAt.toISOString().split('T')[0] === dateStr;
          })
          .reduce((acc, a) => acc + (a.currentPrice || 0), 0);
          
        dailyRevenue.push({ date: dateStr, amount: dayRevenue });
      }

      return successResponse({
        totalSales: soldAuctions.length,
        grossVolume,
        netRevenue,
        avgSalePrice: soldAuctions.length > 0 ? grossVolume / soldAuctions.length : 0,
        sellThroughRate,
        activeListings: activeAuctions.length,
        pendingDeliveries,
        disputeRate: soldAuctions.length > 0 ? (disputes / soldAuctions.length) * 100 : 0,
        shillReports: shillSnap.size,
        dailyRevenue,
      });
    } catch (error) {
      return errorResponse(ErrorType.INTERNAL, 'Failed to fetch retailer stats');
    }
  }
}
