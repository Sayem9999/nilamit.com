/**
 * @deprecated — Pusher has been replaced by Firebase Realtime Database.
 * Use rtdbPush / rtdbSet from @/lib/firebase-admin for server-side events.
 * This stub prevents build errors from any remaining stale imports.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pusherServer: any = null;

export const PUSHER_EVENTS = {
  NEW_BID:           'new_bid',
  AUCTION_CLOSED:    'auction_closed',
  TRUST_UPDATE:      'trust_update',
  ADVANCE_PAID:      'advance_paid',
  PII_VIOLATION:     'pii_violation',
  CHAT_NOTIFICATION: 'chat_notification',
  NEW_MESSAGE:       'new_message',
} as const;
