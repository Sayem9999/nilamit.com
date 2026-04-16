"use server";

import { db } from "@/lib/db";
import { rtdbPush } from "@/lib/firebase-admin";
import { RTDB_PATHS, FIREBASE_EVENTS } from "@/lib/firebase-events";
import { SOFT_CLOSE_WINDOW_MS } from "@/lib/constants";

export async function checkAndAwardBadges(
  userId: string,
  auctionId: string,
  amount: number,
  antiSnipeTriggered: boolean,
  auctionStartTime: Date,
) {
  const badgesAwarded: string[] = [];

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
    }).catch(console.error);
  }
}
