import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS, FIREBASE_EVENTS } from '@/lib/firebase-events';
import { log } from '@/lib/logger';

export class AuctionNotifier {
  private static FOLLOWER_FAN_OUT_CAP = 500;

  /**
   * Push a NEW_LISTING notification to every user that follows this seller.
   */
  static async notifyFollowersOfNewListing(
    auctionId: string,
    sellerId: string,
    title: string,
    coverImage: string | undefined,
  ): Promise<void> {
    const snap = await db.collection('sellerFollows')
      .where('sellerId', '==', sellerId)
      .orderBy('createdAt', 'desc')
      .limit(this.FOLLOWER_FAN_OUT_CAP)
      .get();

    if (snap.empty) return;

    const tasks = snap.docs.map((d) => {
      const followerId = d.data().followerId as string | undefined;
      if (!followerId) return Promise.resolve();
      return rtdbPush(RTDB_PATHS.userNotifications(followerId), {
        event:        FIREBASE_EVENTS.NEW_LISTING,
        auctionId,
        sellerId,
        auctionTitle: title,
        coverImage:   coverImage ?? null,
        timestamp:    Date.now(),
      }).catch((e) => log.error(`[AuctionNotifier] notify follower ${followerId} failed`, e, { auctionId }));
    });

    await Promise.allSettled(tasks);
  }
}
