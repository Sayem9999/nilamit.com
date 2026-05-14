import { db, newId, snapDocs, incrementGlobalStat } from '@/lib/db';
import { PlaceBidResult, Alert } from '@/types';
import { rtdbPush, rtdbSet } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { sendOutbidEmail as firebaseSendOutbidEmail } from '@/lib/firebase-email';
import { sendOutbidAlert } from '@/lib/fcm';
import { ERROR_CODES } from '@/lib/constants';
import { checkAndAwardBadges } from '@/actions/gamification';
import { detectShillBidding } from '@/lib/moderation';
import { log } from '@/lib/logger';
import { validateBidPreconditions, computeAntiSnipeExtension } from './bid-rules';
import { processAuctionSale, sendSaleNotifications } from '@/lib/auction-logic';

interface BidSideEffectParams {
  bidId: string;
  newEndTime: Date;
  newCurrentPrice: number;
  newCurrentBidderId: string | null;
  antiSnipeTriggered: boolean;
  prevBidderId: string | null;
  auctionTitle: string;
  auctionStartTime: Date;
  triggeredAlerts: Alert[];
  sellerId: string;
}

export class BiddingService {
  /**
   * Execute an atomic bid transaction.
   *
   * Correctness notes:
   *   - All values used for validation MUST come from `tx.get(aRef)`. Firestore
   *     transactions only lock document reads via `tx.get`; collection queries
   *     (`.where(...).get()`) inside a transaction are NOT transactional, so
   *     concurrent bids would each read the same "previous" state and both win.
   *   - The previous top bidder (used for outbid notifications) is therefore
   *     denormalised onto the auction document as `currentBidderId`, so we can
   *     read it transactionally.
   *   - Pre-existing alerts for the auction are also fetched OUTSIDE the
   *     transaction (after commit) — they're advisory, not authoritative, and
   *     querying them inside the transaction would expose the same race.
   */
  static async placeBid(auctionId: string, amount: number, userId: string, userName: string, userEmail: string): Promise<PlaceBidResult> {
    return log.time('BiddingService.placeBid', async () => {
      const aRef = db.collection('auctions').doc(auctionId);

      const txResult = await db.runTransaction(async (tx) => {
        const aSnap = await tx.get(aRef);
        if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

        const auction = aSnap.data() as {
          status: string;
          endTime: { toDate: () => Date } | Date;
          startTime: { toDate: () => Date } | Date;
          sellerId: string;
          currentPrice: number;
          startingPrice: number;
          minBidIncrement?: number;
          currentBidderId?: string | null;
          proxyMaxBid?: number;
          proxyBidderId?: string | null;
          reservePrice?: number | null;
          bidCount?: number;
          wasExtended?: boolean;
          secondHighestBidderId?: string | null;
          secondHighestBidAmount?: number;
          title: string;
        };
        const now     = new Date();
        const endTime = (auction.endTime as { toDate?: () => Date })?.toDate ? (auction.endTime as { toDate: () => Date }).toDate() : new Date(auction.endTime as string | number | Date);
        const increment = auction.minBidIncrement ?? 10;

        validateBidPreconditions({
          auctionStatus:   auction.status,
          endTime,
          startTime:       auction.startTime as Date | string,
          sellerId:        auction.sellerId,
          bidderId:        userId,
          currentPrice:    auction.currentPrice,
          startingPrice:   auction.startingPrice,
          minBidIncrement: increment,
          amount,
          now,
        });

        const prevBidderId: string | null = auction.currentBidderId ?? null;
        const existingProxy = auction.proxyMaxBid ?? 0;
        const existingProxyBidder = auction.proxyBidderId ?? null;

        let newCurrentPrice = auction.currentPrice;
        let newCurrentBidderId = auction.currentBidderId;
        let newProxyMaxBid = auction.proxyMaxBid ?? 0;
        let newProxyBidderId = auction.proxyBidderId ?? null;
        
        let newSecondHighestBidderId = auction.secondHighestBidderId ?? null;
        let newSecondHighestBidAmount = auction.secondHighestBidAmount ?? 0;

        // ─── PROXY BIDDING LOGIC ───
        if (!newCurrentBidderId) {
          // First bid ever
          newCurrentPrice = auction.startingPrice;
          newCurrentBidderId = userId;
          newProxyMaxBid = amount;
          newProxyBidderId = userId;
        } else if (userId === existingProxyBidder) {
          // Current leader is topping up their own proxy
          if (amount > existingProxy) {
            newProxyMaxBid = amount;
          } else {
            throw new Error('You already have a higher or equal max bid.');
          }
        } else {
          // Competitive bidding
          if (amount > existingProxy) {
            // New bidder overtakes the old proxy
            newSecondHighestBidderId = existingProxyBidder;
            newSecondHighestBidAmount = existingProxy;
            
            newCurrentPrice = Math.min(amount, existingProxy + increment);
            newCurrentBidderId = userId;
            newProxyMaxBid = amount;
            newProxyBidderId = userId;
          } else {
            // New bidder fails to overtake the old proxy
            newSecondHighestBidderId = userId;
            newSecondHighestBidAmount = amount;

            newCurrentPrice = Math.min(existingProxy, amount + increment);
            // newCurrentBidderId remains the existingProxyBidder
            newCurrentBidderId = existingProxyBidder;
            // newProxyMaxBid remains the same
          }
        }

        // ─── RESERVE PRICE CHECK ───
        const isReserveMet = auction.reservePrice ? newCurrentPrice >= auction.reservePrice : true;

        // Create bid record (audit trail)
        const bidId  = newId();
        const bidRef = db.collection('bids').doc(bidId);
        tx.set(bidRef, { 
          id: bidId, 
          amount,
          publicAmount: newCurrentPrice,
          auctionId, 
          bidderId: userId, 
          sellerId: auction.sellerId, // DENORMALIZATION for shill detection
          createdAt: now, 
          isProxy: true 
        });

        // If the new current bidder is NOT the user who just placed a bid (i.e. their proxy outbid this user),
        // we should create a secondary "auto-bid" record for the proxy winner to keep the bid history continuous.
        if (newCurrentBidderId && newCurrentBidderId !== userId) {
          const autoBidId = newId();
          const autoBidRef = db.collection('bids').doc(autoBidId);
          tx.set(autoBidRef, {
            id: autoBidId,
            amount: newProxyMaxBid,
            publicAmount: newCurrentPrice,
            auctionId,
            bidderId: newCurrentBidderId,
            sellerId: auction.sellerId,
            createdAt: new Date(now.getTime() + 1), // 1ms later to sort correctly
            isProxy: true,
            isAuto: true
          });
        }

        // Anti-sniping
        const { newEndTime, triggered: antiSnipeTriggered } = computeAntiSnipeExtension({ endTime, now });

        tx.update(aRef, {
          currentPrice:    newCurrentPrice,
          currentBidderId: newCurrentBidderId,
          proxyMaxBid:     newProxyMaxBid,
          proxyBidderId:   newProxyBidderId,
          secondHighestBidderId: newSecondHighestBidderId,
          secondHighestBidAmount: newSecondHighestBidAmount,
          isReserveMet,
          endTime:         newEndTime,
          wasExtended:     antiSnipeTriggered ? true : (auction.wasExtended || false),
          bidCount:        (auction.bidCount ?? 0) + 1,
          updatedAt:       now,
        });

        return {
          bidId,
          newEndTime,
          newCurrentPrice,
          newCurrentBidderId,
          antiSnipeTriggered,
          prevBidderId,
          auctionTitle:    auction.title,
          auctionStartTime: (auction.startTime as { toDate?: () => Date })?.toDate ? (auction.startTime as { toDate: () => Date }).toDate() : new Date(auction.startTime as string | number | Date),
          sellerId:        auction.sellerId,
        };
      });

      // Fire-and-forget side effects — must not block the bid response
      this.handleBidSideEffects(txResult, auctionId, userId, userName, userEmail, amount).catch(
        (e) => log.error('[BiddingService] handleBidSideEffects uncaught', e, { auctionId, userId })
      );

      // Increment global stats (Fire and forget)
      incrementGlobalStat('totalBids').catch(() => {});

      return {
        bid: { id: txResult.bidId, amount, auctionId, bidderId: userId, createdAt: new Date() },
        newEndTime: txResult.newEndTime,
        antiSnipeTriggered: txResult.antiSnipeTriggered,
      };
    }, { auctionId, userId, amount });
  }

  /**
   * Find active alerts for an auction that should fire because of `amount`.
   * Deactivates any TARGET_REACHED alerts that triggered. Runs OUTSIDE the
   * bid transaction — it is advisory, not authoritative state.
   */
  private static async processAlertsAfterBid(
    auctionId: string,
    bidderId: string,
    amount: number,
  ): Promise<Alert[]> {
    const alertsSnap = await db.collection('alerts')
      .where('auctionId', '==', auctionId)
      .where('isActive', '==', true)
      .get();

    const alerts = snapDocs<Alert>(alertsSnap);
    const triggered = alerts.filter((a) =>
      a.userId !== bidderId &&
      (a.type === 'OUTBID' || (a.type === 'TARGET_REACHED' && (a.thresholdPrice ?? 0) <= amount))
    );

    const targetReached = triggered.filter((a) => a.type === 'TARGET_REACHED');
    // Advisory deactivation — running outside a transaction is intentional
    // (cost: at most a duplicate notification on contention). Chunk to stay
    // within Firestore's 500-write batch limit.
    if (targetReached.length > 0) {
      const BATCH_LIMIT = 450;
      for (let i = 0; i < targetReached.length; i += BATCH_LIMIT) {
        const slice = targetReached.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const a of slice) {
          batch.update(db.collection('alerts').doc(a.id), { isActive: false });
        }
        await batch.commit();
      }
    }

    return triggered;
  }

  /**
   * Handle all post-bid triggers like emails, push, and RTDB updates
   */
  private static async handleBidSideEffects(txResult: Omit<BidSideEffectParams, 'triggeredAlerts'>, auctionId: string, userId: string, userName: string, userEmail: string, amount: number) {
    // 1. Fetch side-effect data OUTSIDE critical transaction path
    let triggeredAlerts: Alert[] = [];
    let prevBidderEmail: string | null = null;

    let newCurrentBidderName = userName;

    try {
      [triggeredAlerts, prevBidderEmail] = await Promise.all([
        this.processAlertsAfterBid(auctionId, userId, amount),
        (async () => {
          if (!txResult.prevBidderId || txResult.prevBidderId === userId) return null;
          const pbSnap = await db.collection('users').doc(txResult.prevBidderId).get();
          return pbSnap.data()?.email ?? null;
        })(),
        (async () => {
          if (txResult.newCurrentBidderId && txResult.newCurrentBidderId !== userId) {
            const cbSnap = await db.collection('users').doc(txResult.newCurrentBidderId).get();
            newCurrentBidderName = cbSnap.data()?.name ?? 'Someone';
          }
        })()
      ]);
    } catch (e) {
      log.error('[BiddingService] Failed to fetch side-effect data', e, { auctionId, userId });
    }

    const result: BidSideEffectParams = { ...txResult, triggeredAlerts };

    // 2. Fire-and-forget notifications (Parallelized & Isolated)
    const tasks = [
      // Outbid Email
      (async () => {
        if (prevBidderEmail && prevBidderEmail !== userEmail) {
          await firebaseSendOutbidEmail(prevBidderEmail, result.auctionTitle, amount, auctionId);
        }
      })().catch(e => log.error('bidding: outbid email failed', e, { auctionId })),

      // Price Alerts (RTDB)
      (async () => {
        if (result.triggeredAlerts.length > 0) {
          await Promise.all(result.triggeredAlerts.map((alert: Alert) =>
            rtdbPush(RTDB_PATHS.userNotifications(alert.userId), {
              event: FIREBASE_EVENTS.PRICE_ALERT, auctionId,
              auctionTitle: result.auctionTitle, amount, type: alert.type, threshold: alert.thresholdPrice,
            })
          ));
        }
      })().catch(e => log.error('bidding: price alert notifications failed', e, { auctionId })),

      // Outbid RTDB + FCM
      (async () => {
        if (result.prevBidderId && result.prevBidderId !== userId) {
          await Promise.all([
            rtdbPush(RTDB_PATHS.userNotifications(result.prevBidderId), {
              event: FIREBASE_EVENTS.OUTBID_ALERT, auctionId,
              auctionTitle: result.auctionTitle, amount, newBidderName: userName ?? null,
            }),
            sendOutbidAlert(result.prevBidderId, result.auctionTitle, amount)
          ]);
        }
      })().catch(e => log.error('bidding: outbid notifications failed', e, { auctionId })),

      // RTDB Live State
      (async () => {
        const now = new Date();
        await Promise.all([
          rtdbSet(RTDB_PATHS.auctionBid(auctionId), {
            event: FIREBASE_EVENTS.NEW_BID, id: result.bidId, amount: result.newCurrentPrice,
            endTime: result.newEndTime.toISOString(), bidderName: newCurrentBidderName,
            bidderId: result.newCurrentBidderId, createdAt: now.toISOString(),
          }),
          rtdbPush(RTDB_PATHS.auctionActivity(auctionId), {
            event: FIREBASE_EVENTS.NEW_BID, id: result.bidId, amount: result.newCurrentPrice, bidderName: newCurrentBidderName,
            bidderId: result.newCurrentBidderId, createdAt: now.toISOString(),
          }),
          rtdbPush(RTDB_PATHS.globalActivity(), {
            event: FIREBASE_EVENTS.NEW_BID, amount: result.newCurrentPrice, 
            bidderName: newCurrentBidderName, auctionTitle: result.auctionTitle,
            auctionId, timestamp: now.getTime(), bidderId: result.newCurrentBidderId,
          })
        ]);
      })().catch(e => log.error('bidding: RTDB state updates failed', e, { auctionId })),

      // Gamification & Moderation
      checkAndAwardBadges(userId, auctionId, amount, result.antiSnipeTriggered, result.auctionStartTime)
        .catch(e => log.error('bidding: badge check failed', e, { auctionId, userId })),
      detectShillBidding(auctionId, userId, result.sellerId, amount)
        .catch(e => log.error('bidding: shill detection failed', e, { auctionId, userId }))
    ];

    // Wait for all non-critical tasks to at least start/settle
    await Promise.allSettled(tasks);
  }

  /**
   * Atomic BIN purchase: closes auction and initiates escrow.
   */
  static async executeBuyItNow(auctionId: string, userId: string, userName: string, userEmail: string | null): Promise<void> {
    const notifyPayload = await db.runTransaction(async (tx) => {
      const aRef = db.collection('auctions').doc(auctionId);
      const aSnap = await tx.get(aRef);
      if (!aSnap.exists) throw new Error(ERROR_CODES.NOT_FOUND);

      const auction = aSnap.data()!;
      if (auction.status !== 'ACTIVE') throw new Error(ERROR_CODES.AUCTION_NOT_ACTIVE);

      const now = new Date();
      const endTime = auction.endTime?.toDate ? auction.endTime.toDate() : new Date(auction.endTime);
      if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
        throw new Error(ERROR_CODES.AUCTION_ENDED);
      }

      if (now < new Date(auction.startTime || 0)) throw new Error('AUCTION_NOT_STARTED');
      if (now >= endTime) throw new Error(ERROR_CODES.AUCTION_ENDED);
      if (auction.sellerId === userId) throw new Error(ERROR_CODES.SELF_BID_FORBIDDEN);
      if (!auction.buyItNowPrice) throw new Error('BUY_IT_NOW_NOT_AVAILABLE');

      const sellerSnap = await tx.get(db.collection('users').doc(auction.sellerId));
      const sellerData = sellerSnap.data() || {};

      return processAuctionSale(
        tx,
        {
          id: auctionId,
          title: auction.title,
          sellerId: auction.sellerId,
          deliveryCharge: auction.deliveryCharge,
          reservePrice: auction.reservePrice,
        },
        { id: auction.sellerId, isVerifiedSeller: sellerData.isVerifiedSeller ?? false },
        {
          id:    userId,
          email: userEmail,
          name:  userName,
        },
        auction.buyItNowPrice,
      );
    });

    if (notifyPayload) sendSaleNotifications(notifyPayload);
  }

  static async getAuctionBids(auctionId: string) {
    const snap = await db.collection('bids')
      .where('auctionId', '==', auctionId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const bidderIds = [...new Set(snap.docs.map(d => d.data().bidderId as string))];
    let biddersMap = new Map<string, { id: string; name: string | null; image: string | null }>();
    
    if (bidderIds.length > 0) {
      const bidderRefs = bidderIds.map(id => db.collection('users').doc(id));
      const bidderSnaps = await db.getAll(...bidderRefs);
      biddersMap = new Map(bidderSnaps.map(s => [s.id, { id: s.id, name: s.data()?.name ?? null, image: s.data()?.image ?? null }]));
    }

    return snap.docs.map((d) => {
      const b = d.data() as { amount: number; publicAmount?: number; auctionId: string; bidderId: string; createdAt: { toDate?: () => Date } | Date };
      const createdAt = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.() ?? new Date();
      return {
        id: d.id,
        amount: b.publicAmount ?? b.amount,
        auctionId: b.auctionId,
        bidderId: b.bidderId,
        createdAt,
        bidder: biddersMap.get(b.bidderId) ?? { id: b.bidderId, name: null as string | null, image: null as string | null },
      };
    });
  }
}
