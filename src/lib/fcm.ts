import * as admin from 'firebase-admin';
import { log } from '@/lib/logger';

// Ensure Firebase Admin is initialized (this is usually done in lib/firebase-admin.ts)
// But we can safely use admin.messaging() if it's already initialized.

/**
 * Sends a real-time outbid alert to a specific user using Firebase Cloud Messaging.
 */
export async function sendOutbidAlert(userId: string, auctionTitle: string, newBidAmount: number) {
  try {
    if (!admin.apps.length) {
      log.warn('Firebase Admin not initialized, skipping FCM alert.');
      return;
    }

    // In a real app, you would fetch the user's FCM tokens from Firestore
    // const userDoc = await admin.firestore().collection('users').doc(userId).get();
    // const tokens = userDoc.data()?.fcmTokens || [];
    // if (!tokens.length) return;

    // For now, we simulate the FCM payload generation
    const message = {
      notification: {
        title: 'You have been outbid! 🚨',
        body: `Someone just bid ৳${newBidAmount} on "${auctionTitle}". Bid higher to win!`,
      },
      data: {
        type: 'OUTBID',
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // standard fallback
      },
      topic: `user_${userId}_alerts` // Using pub/sub topic as a mock mechanism
      // tokens: tokens // (Actual production implementation)
    };

    // await admin.messaging().sendEachForMulticast({ ...message, tokens });
    await admin.messaging().send(message as admin.messaging.Message);
    log.info(`FCM Outbid Alert sent to user ${userId}`);
  } catch (error) {
    log.error('Failed to send FCM outbid alert:', error as Error);
  }
}
