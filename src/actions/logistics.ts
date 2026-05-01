'use server';

import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { ErrorType, errorResponse, successResponse } from '@/lib/errors';

/**
 * Logistics Statuses based on real-world courier flows.
 */
export const LogisticsStatus = {
  PENDING:          'PENDING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  PICKED_UP:        'PICKED_UP',
  IN_TRANSIT:       'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED:        'DELIVERED',
  FAILED:           'FAILED',
} as const;

export type LogisticsStatus = typeof LogisticsStatus[keyof typeof LogisticsStatus];

/**
 * Mocks an integration with a local Bangladeshi courier API (e.g., Pathao or RedX).
 */
export async function createLogisticsOrder(auctionId: string, sellerId: string, buyerId: string) {
  try {
    const [sellerSnap, buyerSnap] = await Promise.all([
      db.collection('users').doc(sellerId).get(),
      db.collection('users').doc(buyerId).get()
    ]);

    const seller = sellerSnap.data();
    const buyer  = buyerSnap.data();

    if (!buyer?.address || !seller?.address) {
      log.warn(`Logistics deferred for ${auctionId}: Missing addresses`);
      return errorResponse(ErrorType.VALIDATION, 'ADDRESS_REQUIRED', 'ADDRESS_REQUIRED');
    }
    
    const trackingId = `NLM-${Date.now().toString(36).toUpperCase()}`;
    const labelUrl = `https://nilamit.com/labels/${trackingId}.pdf`;

    await db.collection('auctions').doc(auctionId).update({
      logistics: {
        provider: 'NILAMIT_EXPRESS',
        trackingId,
        labelUrl,
        status: LogisticsStatus.READY_FOR_PICKUP,
        pickupAddress: seller.address,
        deliveryAddress: buyer.address,
        updatedAt: new Date(),
        history: [
          { status: LogisticsStatus.PENDING, timestamp: new Date(), note: 'Order created in Nilamit' },
          { status: LogisticsStatus.READY_FOR_PICKUP, timestamp: new Date(), note: 'Awaiting courier pickup' }
        ]
      }
    });

    log.info(`Logistics order created for auction ${auctionId}`, { trackingId });

    return successResponse({ trackingId, labelUrl });
  } catch (error) {
    const e = error as Error;
    log.error('Logistics initialization error:', e);
    return errorResponse(ErrorType.INTERNAL, e.message);
  }
}

/**
 * Simulates a webhook update from a courier provider.
 */
export async function updateLogisticsStatus(auctionId: string, status: LogisticsStatus, note?: string) {
  try {
    const auctionRef = db.collection('auctions').doc(auctionId);
    const auctionSnap = await auctionRef.get();
    
    if (!auctionSnap.exists) throw new Error('Auction not found');
    const auction = auctionSnap.data()!;
    
    const currentLogistics = auction.logistics || {};
    const history = currentLogistics.history || [];
    
    const updatedLogistics = {
      ...currentLogistics,
      status,
      updatedAt: new Date(),
      history: [
        ...history,
        { status, timestamp: new Date(), note: note || `Status updated to ${status}` }
      ]
    };

    await auctionRef.update({ logistics: updatedLogistics });
    
    // If delivered, we can potentially trigger escrow auto-release logic here (like eBay)
    
    return successResponse(null);
  } catch (error) {
    log.error('Failed to update logistics status:', error);
    return errorResponse(ErrorType.INTERNAL, 'Update failed');
  }
}
