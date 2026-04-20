'use server';

import { z } from 'zod';
import { db, newId } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { PlaceBidResult } from '@/types';
import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendOutbidEmail as firebaseSendOutbidEmail } from '@/lib/firebase-email';
import { sendOutbidAlert } from '@/lib/fcm';
import { ERROR_CODES, SOFT_CLOSE_WINDOW_MS, SOFT_CLOSE_EXTENSION_MS } from '@/lib/constants';
import { checkAndAwardBadges } from './gamification';
import { processAuctionSale } from '@/lib/auction-logic';
import { log } from '@/lib/logger';
import { headers } from 'next/headers';
import { bidLimiter } from '@/lib/ratelimit';
import * as Sentry from '@sentry/nextjs';
import { detectShillBidding } from '@/lib/moderation';

const PlaceBidSchema = z.object({
  auctionId: z.string().min(1),
  amount:    z.number().positive(),
});

export async function placeBid(auctionId: string, amount: number): Promise<PlaceBidResult> {
  const v = PlaceBidSchema.safeParse({ auctionId, amount });
  if (!v.success) return { success: false, error: ERROR_CODES.VALIDATION_ERROR };

  const session = await auth();
  if (!session?.user?.id) return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };
  const userId = session.user.id;

  const ip = headers().get('x-forwarded-for') ?? '127.0.0.1';
  const { success: rateLimitSuccess } = await bidLimiter.limit(`bid_${userId}_${ip}`);
  if (!rateLimitSuccess) return { success: false, error: 'Too many bids placed rapidly. Please wait a moment.' };

  // User checks — done outside transaction for efficiency
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return { success: false, error: ERROR_CODES.NOT_FOUND };
  const user = userSnap.data()!;

  if (!user.isPhoneVerified) return { success: false, error: ERROR_CODES.PHONE_NOT_VERIFIED };

  if (amount >= 100000 && !user.isVerifiedSeller) {
    const depositSnap = await db.collection('bidDeposits')
      .where('bidderId', '==', userId)
      .where('auctionId', '==', auctionId)
      .where('status', '==', 'held')
      .limit(1).get();
    if (depositSnap.empty) {
      return { success: false, error: 'BID_DEPOSIT_REQUIRED_FOR_ELITE_AUCTION' };
    }
  }

  try {
    const result = await db.runTransaction(async (tx) => {
      const aRef  = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE')    throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      const now     = new Date();
      const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
      if (now >= endTime)                  throw new Error(ERROR_CODES.AUCTION_ENDED);
      if (auction.sellerId === userId)     throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);

      const minRequired = (auction.currentPrice ?? auction.startingPrice) + (auction.minBidIncrement ?? 10);
      if (amount < minRequired) throw new Error(`${ERROR_CODES.BID_TOO_LOW}: ৳${minRequired.toLocaleString()}`);

      // Previous top bid for outbid notification
      const prevBidsSnap = await db.collection('bids')
        .where('auctionId', '==', auctionId)
        .orderBy('amount', 'desc')
        .limit(1)
        .get();
      const prevBid = prevBidsSnap.empty ? null : prevBidsSnap.docs[0].data();

      // Create bid
      const bidId  = newId();
      const bidRef = db.collection('bids').doc(bidId);
      tx.set(bidRef, { id: bidId, amount, auctionId, bidderId: userId, createdAt: now });

      // Anti-sniping
      const timeUntilEnd     = endTime.getTime() - now.getTime();
      let newEndTime         = endTime;
      let antiSnipeTriggered = false;

      if (!auction.wasExtended && timeUntilEnd <= SOFT_CLOSE_WINDOW_MS) {
        newEndTime         = new Date(endTime.getTime() + SOFT_CLOSE_EXTENSION_MS);
        antiSnipeTriggered = true;
      }

      tx.update(aRef, {
        currentPrice: amount,
        endTime:      newEndTime,
        wasExtended:  antiSnipeTriggered ? true : auction.wasExtended,
        bidCount:     (auction.bidCount ?? 0) + 1,
        updatedAt:    now,
      });

      // Active alerts for this auction
      const alertsSnap = await db.collection('alerts')
        .where('auctionId', '==', auctionId)
        .where('isActive', '==', true)
        .get();

      const triggeredAlerts = alertsSnap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter(a =>
          a.userId !== userId &&
          (a.type === 'OUTBID' || (a.type === 'TARGET_REACHED' && (a.thresholdPrice ?? 0) <= amount))
        );

      // Deactivate one-time TARGET_REACHED alerts
      triggeredAlerts
        .filter(a => a.type === 'TARGET_REACHED')
        .forEach(a => tx.update(db.collection('alerts').doc(a.id), { isActive: false }));

      return {
        bidId, newEndTime, antiSnipeTriggered,
        prevBidderId:  prevBid?.bidderId ?? null,
        prevBidderEmail: null as string | null, // fetched outside
        auctionTitle:  auction.title,
        auctionStartTime: auction.startTime?.toDate ? auction.startTime.toDate() : new Date(auction.startTime),
        triggeredAlerts,
        timeUntilEnd,
        sellerId: auction.sellerId,
      };
    });

    // Fetch prev bidder email outside transaction
    let prevBidderEmail: string | null = null;
    if (result.prevBidderId && result.prevBidderId !== userId) {
      const pbSnap = await db.collection('users').doc(result.prevBidderId).get();
      prevBidderEmail = pbSnap.data()?.email ?? null;
    }

    // Outbid email
    if (prevBidderEmail && prevBidderEmail !== session.user.email) {
      firebaseSendOutbidEmail(prevBidderEmail, result.auctionTitle, amount, auctionId).catch(console.error);
    }

    // Alert notifications
    if (result.triggeredAlerts.length > 0) {
      await Promise.all(result.triggeredAlerts.map(alert =>
        rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
          event: FIREBASE_EVENTS.PRICE_ALERT, auctionId,
          auctionTitle: result.auctionTitle, amount, type: alert.type, threshold: alert.thresholdPrice,
        })
      )).catch(console.error);
    }

    // Outbid push notification (RTDB + FCM)
    if (result.prevBidderId && result.prevBidderId !== userId) {
      rtdbPush(RTDB_PATHS.userNotifications(result.prevBidderId), {
        event: FIREBASE_EVENTS.OUTBID_ALERT, auctionId,
        auctionTitle: result.auctionTitle, amount, newBidderName: session.user.name ?? null,
      }).catch(console.error);

      // Trigger actual mobile/web push notification
      sendOutbidAlert(result.prevBidderId, result.auctionTitle, amount).catch(console.error);
    }

    // Real-time bid state
    rtdbSet(RTDB_PATHS.auctionBid(auctionId), {
      event: FIREBASE_EVENTS.NEW_BID, amount,
      endTime: result.newEndTime.toISOString(), bidderName: session.user.name ?? 'Someone',
    }).catch(console.error);

    rtdbPush(RTDB_PATHS.auctionActivity(auctionId), {
      event: FIREBASE_EVENTS.NEW_BID, amount, bidderName: session.user.name ?? 'Someone',
    }).catch(console.error);

    rtdbPush(RTDB_PATHS.globalActivity(), {
      event: 'new_activity', bidder: session.user.name ?? 'Someone',
      auctionTitle: result.auctionTitle, amount, auctionId,
    }).catch(console.error);

    // Gamification (async)
    checkAndAwardBadges(userId, auctionId, amount, result.antiSnipeTriggered, result.auctionStartTime)
      .catch(console.error);

    // Moderation (async)
    detectShillBidding(auctionId, userId, result.sellerId, amount).catch(console.error);

    return {
      success: true,
      bid: { id: result.bidId, amount, auctionId, bidderId: userId, createdAt: new Date() },
      newEndTime: result.newEndTime,
      antiSnipeTriggered: result.antiSnipeTriggered,
    };
  } catch (error) {
    const message  = error instanceof Error ? error.message : 'Failed to place bid.';
    const known    = Object.values(ERROR_CODES) as string[];
    if (!known.some(c => message.startsWith(c))) {
      log.error('placeBid unexpected failure', error, { userId, auctionId, amount });
      Sentry.captureException(error, {
        tags: { action: 'placeBid' },
        contexts: { auction: { auctionId, amount, userId } }
      });
    }
    return { success: false, error: message };
  }
}

export async function executeBuyItNow(auctionId: string): Promise<PlaceBidResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: ERROR_CODES.NOT_AUTHENTICATED };
  const userId = session.user.id;

  try {
    const result = await db.runTransaction(async (tx) => {
      const aRef  = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error('Auction not found.');
      const auction = aSnap.data()!;
      if (!auction.buyItNowPrice)      throw new Error('No Buy It Now price set.');
      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);
      if (auction.sellerId === userId) throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);

      const sellerSnap = await tx.get(db.collection('users').doc(auction.sellerId));
      const seller     = sellerSnap.data() ?? {};

      const bidId  = newId();
      tx.set(db.collection('bids').doc(bidId), {
        id: bidId, amount: auction.buyItNowPrice, auctionId, bidderId: userId, createdAt: new Date(),
      });

      await processAuctionSale(
        tx,
        { id: auctionId, title: auction.title, sellerId: auction.sellerId,
          deliveryCharge: auction.deliveryCharge, reservePrice: auction.reservePrice },
        { id: auction.sellerId, isVerifiedSeller: seller.isVerifiedSeller ?? false },
        { id: userId, email: session.user.email ?? null, name: session.user.name ?? null },
        auction.buyItNowPrice,
      );

      return { bidId, binAmount: auction.buyItNowPrice, auctionTitle: auction.title };
    });

    rtdbSet(RTDB_PATHS.auctionBid(auctionId), {
      event: FIREBASE_EVENTS.AUCTION_SOLD, winnerName: session.user.name ?? 'Someone', price: result.binAmount,
    }).catch(console.error);

    return { success: true, bid: { id: result.bidId, amount: result.binAmount, auctionId, bidderId: userId, createdAt: new Date() } };
  } catch (e) {
    Sentry.captureException(e, { tags: { action: 'executeBuyItNow' }, contexts: { auction: { auctionId, userId } } });
    return { success: false, error: e instanceof Error ? e.message : 'Failed.' };
  }
}

export async function getAuctionBids(auctionId: string) {
  const snap = await db.collection('bids')
    .where('auctionId', '==', auctionId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const bidderIds = [...new Set(snap.docs.map(d => d.data().bidderId as string))];
  const bidderSnaps = await Promise.all(bidderIds.map(id => db.collection('users').doc(id).get()));
  const biddersMap  = new Map(bidderSnaps.map(s => [s.id, { id: s.id, name: s.data()?.name ?? null, image: s.data()?.image ?? null }]));

  return snap.docs.map(d => {
    const b = d.data();
    return { ...b, id: d.id, createdAt: b.createdAt?.toDate?.() ?? new Date(b.createdAt),
      bidder: biddersMap.get(b.bidderId) ?? { id: b.bidderId, name: null, image: null } };
  });
}

export async function getMyBids() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const snap = await db.collection('bids')
    .where('bidderId', '==', session.user.id)
    .orderBy('createdAt', 'desc')
    .get();

  return Promise.all(snap.docs.map(async d => {
    const b = d.data();
    const aSnap = await db.collection('auctions').doc(b.auctionId).get();
    const a     = aSnap.data() ?? {};
    return { ...b, id: d.id, createdAt: b.createdAt?.toDate?.() ?? new Date(b.createdAt),
      auction: { id: b.auctionId, title: a.title ?? '', images: a.images ?? [],
        currentPrice: a.currentPrice ?? 0,
        endTime: a.endTime?.toDate?.() ?? new Date(a.endTime),
        status: a.status ?? 'EXPIRED' } };
  }));
}
