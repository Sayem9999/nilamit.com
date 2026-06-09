import { db, newId, incrementGlobalStat } from '@/lib/db';
import { Auction } from '@/types';
import { sanitizeObject } from '@/lib/sanitizer';
import { filterPII } from '@/lib/pii-filter';
import { ErrorType, ServiceResponse, successResponse, errorResponse } from '@/lib/errors';
import { log } from '@/lib/logger';
import type { CreateAuctionInputValidated } from '@/lib/schemas';
import { scheduleAuctionClosure, scheduleClosingSoonAlert } from '@/lib/cloud-tasks';
import { AuctionNotifier } from './auction-notifier';
import { AuditService } from '@/services/admin/audit-service';
import { indexAuction } from '@/lib/search-engine';

export class AuctionWriter {
  /**
   * Create a new auction listing
   */
  static async create(input: CreateAuctionInputValidated, userId: string): Promise<ServiceResponse<Auction>> {
    try {
      const sanitizedInput = sanitizeObject(input);
      const filteredTitle = filterPII(sanitizedInput.title);
      const filteredDescription = filterPII(sanitizedInput.description);

      const id = newId();
      const now = new Date();

      const auction: Auction = {
        id,
        title: filteredTitle,
        description: filteredDescription,
        images: sanitizedInput.images,
        category: sanitizedInput.category,
        startingPrice: sanitizedInput.startingPrice,
        currentPrice: sanitizedInput.startingPrice,
        currentBidderId: null,
        minBidIncrement: sanitizedInput.minBidIncrement ?? 10,
        startTime: new Date(sanitizedInput.startTime),
        endTime: new Date(sanitizedInput.endTime),
        reservePrice: sanitizedInput.reservePrice ?? null,
        buyItNowPrice: sanitizedInput.buyItNowPrice ?? null,
        location: sanitizedInput.location ?? null,
        condition: sanitizedInput.condition ?? null,
        sellerId: userId,
        winnerId: null,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        bidCount: 0,
        piiDetected: filteredTitle !== sanitizedInput.title || filteredDescription !== sanitizedInput.description
      };

      await db.collection('auctions').doc(id).set(auction);
      
      // Log audit change asynchronously
      AuditService.logAuctionChange(id, null, auction, 'CREATE', userId).catch(() => {});

      incrementGlobalStat('totalAuctions').catch(() => {});

      // Index into the external search engine (no-op until provisioned). Source
      // of truth stays Firestore — this is a thin projection for keyword search.
      indexAuction(auction as unknown as Record<string, unknown>)
        .catch((e) => log.warn('[AuctionWriter] search index failed', { auctionId: id, error: String(e) }));

      AuctionNotifier.notifyFollowersOfNewListing(id, userId, sanitizedInput.title, sanitizedInput.images?.[0])
        .catch((e) => log.error('[AuctionWriter] follower fan-out failed', e, { auctionId: id }));

      scheduleAuctionClosure(id, auction.endTime).catch((e) =>
        log.error('[AuctionWriter] cloud task scheduling failed', e, { auctionId: id })
      );

      if (auction.endTime.getTime() - auction.startTime.getTime() > 3600000) {
        scheduleClosingSoonAlert(id, auction.endTime).catch((e) =>
          log.error('[AuctionWriter] closing soon task scheduling failed', e, { auctionId: id })
        );
      }

      log.info('Auction created successfully', { auctionId: id, sellerId: userId });
      return successResponse(auction);
    } catch (err) {
      log.error('AuctionWriter.create failed', err, { userId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to create auction listing');
    }
  }

  /**
   * Transition an auction to a "Second Chance Offer"
   */
  static async createSecondChanceOffer(auctionId: string): Promise<ServiceResponse<void>> {
    try {
      return await db.runTransaction(async (tx) => {
        const aRef = db.collection('auctions').doc(auctionId);
        const aSnap = await tx.get(aRef);
        if (!aSnap.exists) return errorResponse(ErrorType.NOT_FOUND, 'Auction not found');

        const auction = aSnap.data() as Auction & { 
          secondHighestBidderId?: string | null; 
          secondHighestBidAmount?: number;
        };
        
        const secondBidderId = auction.secondHighestBidderId;
        const secondAmount = auction.secondHighestBidAmount;

        if (!secondBidderId || !secondAmount) {
          return errorResponse(ErrorType.NOT_FOUND, 'No eligible second bidder recorded');
        }

        const beforeState = { ...auction };
        const updateData = {
          status: 'OFFER_PENDING',
          currentBidderId: secondBidderId,
          currentPrice: secondAmount,
          updatedAt: new Date(),
          originalWinnerId: auction.currentBidderId,
        };
        const afterState = { ...beforeState, ...updateData };

        tx.update(aRef, updateData);

        // Log audit change atomically within the transaction
        await AuditService.logAuctionChange(auctionId, beforeState, afterState, 'UPDATE', undefined, tx);

        log.info('Second chance offer created', { auctionId, secondBidderId, secondAmount });
        return successResponse(undefined);
      });
    } catch (err) {
      log.error('AuctionWriter.createSecondChanceOffer failed', err, { auctionId });
      return errorResponse(ErrorType.INTERNAL, 'Failed to process second chance offer');
    }
  }
}
