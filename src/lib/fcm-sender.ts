/**
 * FCM server-side sender (uses firebase-admin/messaging).
 *
 * Pairs with src/lib/fcm.ts (client-side token registration). Called from
 * notification fan-out paths (BidSideEffects, escrow events, outbid alerts)
 * after the in-app RTDB notification has already been written.
 *
 * Push is *additive* to RTDB — RTDB stays the source of truth for unread
 * counts and the dashboard inbox; FCM just brings the user back when the
 * tab isn't open.
 *
 * Invalid/expired tokens are pruned from the user's `fcmTokens` array on
 * the first failed send (saves a separate cleanup pass).
 */

import "server-only";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";
import { db } from "@/lib/db";
import { FieldValue } from "firebase-admin/firestore";
import { log } from "@/lib/logger";

let _app: App | null = null;

function adminApp(): App | null {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    log.warn("[FCM Sender] Firebase Admin env not configured — push disabled.");
    return null;
  }

  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return _app;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Optional URL fragment to deep-link the notification to. */
  clickAction?: string;
  /** Arbitrary extra string data for the service worker / foreground handler. */
  data?: Record<string, string>;
}

/**
 * Send a push to all FCM tokens registered for a user. Silently no-ops if
 * the user has no tokens or FCM isn't configured. Failed/invalid tokens
 * are pruned in-place.
 *
 * Returns the number of successful sends.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  const app = adminApp();
  if (!app) return 0;

  const userSnap = await db.collection("users").doc(userId).get();
  const tokens = (userSnap.data()?.fcmTokens as string[] | undefined) ?? [];
  if (tokens.length === 0) return 0;

  const messaging = getMessaging(app);
  const data: Record<string, string> = { ...(payload.data ?? {}) };
  if (payload.clickAction) data.click_action = payload.clickAction;

  let successes = 0;
  const invalidTokens: string[] = [];

  await Promise.all(
    tokens.map(async (token) => {
      const msg: Message = {
        token,
        notification: { title: payload.title, body: payload.body },
        data,
        webpush: {
          fcmOptions: payload.clickAction ? { link: payload.clickAction } : undefined,
        },
      };
      try {
        await messaging.send(msg);
        successes++;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(token);
        } else {
          log.warn("[FCM Sender] send failed", { userId, code, error: String(err) });
        }
      }
    }),
  );

  // Prune dead tokens so we don't keep retrying them.
  if (invalidTokens.length > 0) {
    try {
      await db.collection("users").doc(userId).update({
        fcmTokens: FieldValue.arrayRemove(...invalidTokens),
      });
    } catch (err) {
      log.warn("[FCM Sender] failed to prune dead tokens", { userId, error: String(err) });
    }
  }

  return successes;
}
