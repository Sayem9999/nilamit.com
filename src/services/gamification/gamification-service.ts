import { db } from "@/lib/db";
import { rtdbPush } from "@/lib/firebase-admin";
import { RTDB_PATHS, FIREBASE_EVENTS } from "@/lib/firebase-events";
import { XP_REWARDS, calculateLevel } from "@/lib/gamification-engine";
import { log } from "@/lib/logger";

export class GamificationService {
  /**
   * Check for badge awards based on bid activity.
   */
  static async checkAndAwardBadges(
    userId: string,
    auctionId: string,
    amount: number,
    antiSnipeTriggered: boolean,
    auctionStartTime: Date,
  ): Promise<void> {
    const badgesAwarded: string[] = [];
    const xpEarned = XP_REWARDS.BID_PLACED;

    // 1. Transactional XP and Level Update
    try {
      await db.runTransaction(async (tx) => {
        const uRef = db.collection('users').doc(userId);
        const uSnap = await tx.get(uRef);
        if (!uSnap.exists) return;

        const userData = uSnap.data()!;
        const currentXP = userData.xp || 0;
        const newXP = currentXP + xpEarned;
        const newLevel = calculateLevel(newXP);

        tx.update(uRef, {
          xp: newXP,
          userLevel: newLevel,
          updatedAt: new Date(),
        });
      });
    } catch (e) {
      log.error('[GamificationService] XP update failed', e, { userId });
    }

    async function awardBadge(badgeId: string) {
      const docId = `${userId}_${badgeId}`;
      const existing = await db.collection('badges').doc(docId).get();
      if (existing.exists) return;
      await db.collection('badges').doc(docId).set({
        id: docId, userId, badgeId, earnedAt: new Date(),
      });
      badgesAwarded.push(badgeId);
    }

    const tasks: Promise<void>[] = [];

    // Sniper badge — bid within 2 min window
    if (antiSnipeTriggered) tasks.push(awardBadge('sniper'));

    // Whale badge — bid >= 100,000
    if (amount >= 100000) tasks.push(awardBadge('whale'));

    // Early bird — bid within first hour of auction
    const hourAfterStart = new Date(auctionStartTime.getTime() + 60 * 60 * 1000);
    if (new Date() <= hourAfterStart) tasks.push(awardBadge('early_bird'));

    // First blood — first bid on this auction
    const bidsSnap = await db.collection('bids')
      .where('auctionId', '==', auctionId)
      .orderBy('createdAt', 'asc')
      .limit(1).get();
    if (!bidsSnap.empty && bidsSnap.docs[0].data().bidderId === userId) {
      tasks.push(awardBadge('first_blood'));
    }

    await Promise.all(tasks);

    if (badgesAwarded.length > 0) {
      rtdbPush(RTDB_PATHS.userNotifications(userId), {
        event:   FIREBASE_EVENTS.TRUST_UPDATE,
        message: `You earned ${badgesAwarded.length} new badge(s): ${badgesAwarded.join(', ')}!`,
        badges:  badgesAwarded,
        timestamp: Date.now(),
      }).catch((e) => log.error('[GamificationService] badge notification push failed', e));
    }
  }

  /**
   * Award XP and update streaks after a successful sale.
   */
  static async processSaleGamification(winnerId: string, sellerId: string): Promise<void> {
    const now = new Date();
    
    // 1. Process Winner
    try {
      await db.runTransaction(async (tx) => {
        const wRef = db.collection('users').doc(winnerId);
        const wSnap = await tx.get(wRef);
        if (!wSnap.exists) return;

        const userData = wSnap.data()!;
        const currentXP = userData.xp || 0;
        const streak = (userData.winningStreak || 0) + 1;
        
        let xpEarned = XP_REWARDS.AUCTION_WON;
        if (streak > 0 && streak % 5 === 0) {
          xpEarned += XP_REWARDS.BONUS_STREAK;
        }

        const newXP = currentXP + xpEarned;
        const newLevel = calculateLevel(newXP);

        tx.update(wRef, {
          xp: newXP,
          userLevel: newLevel,
          winningStreak: streak,
          updatedAt: now,
        });
      });
    } catch (e) {
      log.error('[GamificationService] winner sale update failed', e, { winnerId });
    }

    // 2. Process Seller
    try {
      await db.runTransaction(async (tx) => {
        const sRef = db.collection('users').doc(sellerId);
        const sSnap = await tx.get(sRef);
        if (!sSnap.exists) return;

        const userData = sSnap.data()!;
        const currentXP = userData.xp || 0;
        const newXP = currentXP + XP_REWARDS.SUCCESSFUL_SALE;
        const newLevel = calculateLevel(newXP);

        tx.update(sRef, {
          xp: newXP,
          userLevel: newLevel,
          updatedAt: now,
        });
      });
    } catch (e) {
      log.error('[GamificationService] seller sale update failed', e, { sellerId });
    }
  }
}
