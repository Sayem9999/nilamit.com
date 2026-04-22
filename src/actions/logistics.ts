'use server';

import { db } from '@/lib/db';
import { log } from '@/lib/logger';

interface LogisticsResponse {
  success: boolean;
  trackingId?: string;
  labelUrl?: string;
  error?: string;
}

/**
 * Mocks an integration with a local Bangladeshi courier API (e.g., Pathao or RedX).
 * In a real scenario, this would POST to their API with seller/buyer addresses and item details.
 */
export async function createLogisticsOrder(auctionId: string, sellerId: string, buyerId: string): Promise<LogisticsResponse> {
  try {
    const [sellerSnap, buyerSnap] = await Promise.all([
      db.collection('users').doc(sellerId).get(),
      db.collection('users').doc(buyerId).get()
    ]);

    const seller = sellerSnap.data();
    const buyer  = buyerSnap.data();

    if (!buyer?.address || !seller?.address) {
      log.warn(`Logistics deferred for ${auctionId}: Missing addresses`);
      return { success: false, error: 'ADDRESS_REQUIRED' };
    }
    
    const trackingId = `NLM-${Date.now().toString(36).toUpperCase()}`;
    const labelUrl = `https://nilamit.com/labels/${trackingId}.pdf`;

    await db.collection('auctions').doc(auctionId).update({
      logistics: {
        provider: 'NILAMIT_STANDARD',
        trackingId,
        labelUrl,
        status: 'READY_FOR_PICKUP',
        pickupAddress: seller.address,
        deliveryAddress: buyer.address,
        updatedAt: new Date()
      }
    });

    log.info(`Logistics order created for auction ${auctionId}`, { trackingId });

    return { success: true, trackingId, labelUrl };
  } catch (error) {
    const e = error as Error;
    log.error('Logistics initialization error:', e);
    return { success: false, error: e.message };
  }
}
