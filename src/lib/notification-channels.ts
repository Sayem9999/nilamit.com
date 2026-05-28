/**
 * Multi-channel notification adapters.
 *
 * Frontend code calls notify(userId, payload) — this module fans out
 * across whatever channels the user has opted in to (per
 * users/{uid}.notificationChannels). Each channel is an independent
 * adapter; failure in one (e.g. WhatsApp template not approved yet)
 * doesn't block the others.
 *
 * Channels:
 *   - inApp:   RTDB push to /notifications/user/{uid}/{id}
 *   - fcm:     Firebase Cloud Messaging via existing fcm-sender.ts
 *   - email:   Resend via existing emails.ts
 *   - sms:     Bangladesh SMS gateway via existing src/lib/sms-gateway.ts
 *   - whatsapp: Twilio WhatsApp Business API — TODO(user): set
 *               TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *               in Secret Manager + register WhatsApp templates with Meta
 *               (~2-3 days approval).
 *
 * Defaults if user.notificationChannels is missing: inApp + fcm on, others off.
 * Conservative — opt-in for the chargeable channels (SMS, WhatsApp).
 */

import 'server-only';
import { db } from '@/lib/db';
import { rtdbPush } from '@/lib/firebase-admin';
import { RTDB_PATHS } from '@/lib/firebase-events';
import { pushToUser } from '@/lib/fcm-sender';
import { log } from '@/lib/logger';
import type { NotificationChannelPrefs, User } from '@/types';

const DEFAULTS: NotificationChannelPrefs = {
  inApp: true,
  fcm: true,
  email: false,
  sms: false,
  whatsapp: false,
};

export interface NotifyPayload {
  /** Internal event slug for routing/analytics. */
  type: string;
  title: string;
  body: string;
  /** Optional URL to deep-link the user to (FCM click_action, email button, etc.). */
  clickUrl?: string;
  /** Arbitrary metadata (auctionId, amountBdt, etc.) — preserved across channels. */
  data?: Record<string, string>;
}

/**
 * Fan-out across all enabled channels for a user. Resolves when in-flight
 * sends settle (not necessarily delivered) — caller doesn't need to await.
 * Returns the count of channels that fired (not necessarily delivered).
 */
export async function notify(userId: string, payload: NotifyPayload): Promise<number> {
  const userSnap = await db.collection('users').doc(userId).get();
  const user = userSnap.data() as Partial<User> | undefined;
  if (!user) return 0;
  const channels: NotificationChannelPrefs = { ...DEFAULTS, ...(user.notificationChannels ?? {}) };

  let fired = 0;
  const tasks: Promise<unknown>[] = [];

  if (channels.inApp) {
    tasks.push(
      rtdbPush(RTDB_PATHS.userNotifications(userId), {
        event: payload.type,
        title: payload.title,
        message: payload.body,
        ...(payload.data ?? {}),
        timestamp: Date.now(),
      }).catch((e) => log.warn('[notify] inApp failed', { userId, error: String(e) })),
    );
    fired++;
  }

  if (channels.fcm) {
    tasks.push(
      pushToUser(userId, {
        title: payload.title,
        body: payload.body,
        clickAction: payload.clickUrl,
        data: payload.data,
      }).catch((e) => log.warn('[notify] fcm failed', { userId, error: String(e) })),
    );
    fired++;
  }

  if (channels.email && user.email) {
    // Lazy-import to keep Resend out of the cold-start path of non-email flows.
    const recipient = user.email;
    tasks.push(
      import('@/lib/emails')
        .then((mod) => {
          // We don't have a generic sendNotification template yet; this branch
          // wires in once the email lib exposes one. For now, no-op cleanly.
          const m = mod as Record<string, unknown>;
          if ('sendNotificationEmail' in m && typeof m.sendNotificationEmail === 'function') {
            return (m as { sendNotificationEmail: (to: string, p: NotifyPayload) => Promise<unknown> }).sendNotificationEmail(recipient, payload);
          }
          return undefined;
        })
        .catch((e) => log.warn('[notify] email failed', { userId, error: String(e) })),
    );
    fired++;
  }

  if (channels.sms && user.phoneNumber) {
    tasks.push(sendSms(user.phoneNumber, payload).catch((e) => log.warn('[notify] sms failed', { userId, error: String(e) })));
    fired++;
  }

  if (channels.whatsapp && user.phoneNumber) {
    tasks.push(sendWhatsApp(user.phoneNumber, payload).catch((e) => log.warn('[notify] whatsapp failed', { userId, error: String(e) })));
    fired++;
  }

  // Fire-and-forget settles; don't block on email/SMS round-trips.
  void Promise.allSettled(tasks);
  return fired;
}

// ────────────────────────────────────────────────────────────────────
// Adapters
// ────────────────────────────────────────────────────────────────────

async function sendSms(phoneE164: string, payload: NotifyPayload): Promise<void> {
  // src/lib/sms-gateway.ts already exists with a normalizer — wire when
  // the gateway vendor (e.g. SSL Wireless, Greenweb) credentials land.
  try {
    const mod = await import('@/lib/sms-gateway');
    if ('sendSms' in mod && typeof (mod as Record<string, unknown>).sendSms === 'function') {
      await (mod as { sendSms: (to: string, body: string) => Promise<unknown> }).sendSms(phoneE164, `${payload.title}\n${payload.body}`);
    } else {
      log.debug('[notify.sms] gateway not configured — skipping');
    }
  } catch (err) {
    throw err;
  }
}

async function sendWhatsApp(phoneE164: string, payload: NotifyPayload): Promise<void> {
  // TODO(user): wire Twilio WhatsApp once TWILIO_* secrets are set and
  // approved templates exist in Meta. Until then this no-ops cleanly.
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"
  if (!sid || !token || !from) {
    log.debug('[notify.whatsapp] Twilio not configured — skipping');
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    From: from,
    To: `whatsapp:${phoneE164}`,
    Body: `${payload.title}\n${payload.body}${payload.clickUrl ? `\n${payload.clickUrl}` : ''}`,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Twilio WhatsApp HTTP ${res.status}: ${await res.text()}`);
  }
}
